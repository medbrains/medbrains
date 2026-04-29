// Sprint B.7.2 — SSM RunCommand helpers for Terratest.
//
// Lets us shell into Patroni nodes via Session Manager (no SSH keys, no
// public IPs needed) to run patronictl, psql, pgbackrest commands and
// observe their output. Used by the heavyweight failover/PITR tests.

package patroni_test

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/ec2"
	"github.com/aws/aws-sdk-go-v2/service/ec2/types"
	"github.com/aws/aws-sdk-go-v2/service/ssm"
	ssmtypes "github.com/aws/aws-sdk-go-v2/service/ssm/types"
	"github.com/gruntwork-io/terratest/modules/retry"
)

// runSSM sends a shell command to the given EC2 instance via SSM and
// returns stdout once the command completes (max 60s wait).
func runSSM(t *testing.T, ssmClient *ssm.Client, instanceID, command string) (string, error) {
	t.Helper()
	ctx := context.Background()

	send, err := ssmClient.SendCommand(ctx, &ssm.SendCommandInput{
		InstanceIds:  []string{instanceID},
		DocumentName: aws.String("AWS-RunShellScript"),
		Parameters: map[string][]string{
			"commands": {command},
		},
		TimeoutSeconds: aws.Int32(60),
	})
	if err != nil {
		return "", fmt.Errorf("SendCommand failed: %w", err)
	}

	cmdID := aws.ToString(send.Command.CommandId)
	t.Logf("SSM command %s sent to %s: %s", cmdID, instanceID, command)

	out := retry.DoWithRetry(t, "wait for SSM command", 30, 2*time.Second, func() (string, error) {
		inv, err := ssmClient.GetCommandInvocation(ctx, &ssm.GetCommandInvocationInput{
			CommandId:  aws.String(cmdID),
			InstanceId: aws.String(instanceID),
		})
		if err != nil {
			return "", err
		}
		switch inv.Status {
		case ssmtypes.CommandInvocationStatusSuccess:
			return aws.ToString(inv.StandardOutputContent), nil
		case ssmtypes.CommandInvocationStatusFailed,
			ssmtypes.CommandInvocationStatusCancelled,
			ssmtypes.CommandInvocationStatusTimedOut:
			return "", fmt.Errorf("SSM command status=%s stderr=%s",
				inv.Status, aws.ToString(inv.StandardErrorContent))
		default:
			return "", fmt.Errorf("still %s", inv.Status)
		}
	})
	return out, nil
}

// patroniLeaderID queries the Patroni REST API on each PG node and
// returns the EC2 instance ID of whichever node responds 200 to /leader.
//
// This replaces findLeader() which was a tag-based stub.
func patroniLeaderID(t *testing.T, ec2c *ec2.Client, ssmClient *ssm.Client) string {
	t.Helper()
	ctx := context.Background()

	pgInstances, err := ec2c.DescribeInstances(ctx, &ec2.DescribeInstancesInput{
		Filters: []types.Filter{
			{
				Name:   aws.String("tag:medbrains-pg-cluster"),
				Values: []string{clusterID},
			},
			{
				Name:   aws.String("instance-state-name"),
				Values: []string{"running"},
			},
		},
	})
	if err != nil || len(pgInstances.Reservations) == 0 {
		return ""
	}

	// On each node, curl localhost:8008/leader. Patroni REST returns
	// 200 on the leader, 503 on replicas. The first 200 is the leader.
	for _, res := range pgInstances.Reservations {
		for _, inst := range res.Instances {
			id := aws.ToString(inst.InstanceId)
			out, err := runSSM(t, ssmClient, id,
				"curl -s -o /dev/null -w '%{http_code}' http://localhost:8008/leader")
			if err != nil {
				t.Logf("ssm runCommand to %s failed: %v", id, err)
				continue
			}
			if strings.TrimSpace(out) == "200" {
				return id
			}
		}
	}
	return ""
}

// runPsqlOnLeader executes a SQL statement on the Patroni leader via
// SSM. Returns trimmed stdout.
func runPsqlOnLeader(t *testing.T, ec2c *ec2.Client, ssmClient *ssm.Client, sql string) (string, error) {
	t.Helper()
	leader := patroniLeaderID(t, ec2c, ssmClient)
	if leader == "" {
		return "", errors.New("no leader to run psql on")
	}
	cmd := fmt.Sprintf(
		`sudo -u postgres /usr/pgsql-16/bin/psql -h localhost -t -A -c "%s"`,
		strings.ReplaceAll(sql, `"`, `\"`))
	return runSSM(t, ssmClient, leader, cmd)
}
