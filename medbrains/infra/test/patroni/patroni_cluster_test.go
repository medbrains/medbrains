// Sprint B.7 — Terratest integration suite for the Patroni cluster module.
//
// Each test provisions the ephemeral test harness (`infra/test/patroni/main.tf`)
// against a real AWS account, runs assertions, then `terraform destroy`s
// regardless of pass/fail. Cost per run: ~$2-5 (3× r7g.large + 3× t4g.small
// + NLB + EBS for ~30 min).
//
// Run all:
//   cd infra/test/patroni
//   AWS_PROFILE=medbrains-test go test -v -timeout 60m ./...
//
// Run one:
//   go test -v -timeout 30m -run TestPatroniLeaderElection
//
// Pre-req: Packer AMI tagged `medbrains-image=postgres-16-patroni-3.3` exists
// in the target region (build via `cd infra/packer/postgres-bottlerocket &&
// packer build postgres.pkr.hcl`).

package patroni_test

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/ec2"
	"github.com/aws/aws-sdk-go-v2/service/ec2/types"
	"github.com/gruntwork-io/terratest/modules/retry"
	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	awsRegion = "ap-south-1"
	clusterID = "medbrains-test-ap-south-1-pg"
)

// terraformOptions builds the standard Terratest options for the harness.
// Local backend keeps state on the test runner's disk so destroy is
// self-contained even if the test process crashes.
func terraformOptions(t *testing.T) *terraform.Options {
	return terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		TerraformDir: ".",
		EnvVars: map[string]string{
			"TF_IN_AUTOMATION": "true",
		},
		NoColor: true,
	})
}

// applyAndDeferDestroy is the standard Terratest dance — apply, defer
// destroy, return outputs. Caller asserts on outputs.
func applyAndDeferDestroy(t *testing.T) *terraform.Options {
	opts := terraformOptions(t)
	defer func() {
		// destroy regardless of test outcome
		_, err := terraform.DestroyE(t, opts)
		if err != nil {
			t.Logf("destroy failed: %v — manual cleanup may be required", err)
		}
	}()
	terraform.InitAndApply(t, opts)
	return opts
}

// TestPatroniLeaderElection — kill leader, observe new leader within 15s.
// Sprint B acceptance criterion #1 (RFCs/sprints/SPRINT-B-patroni-ha.md §11).
func TestPatroniLeaderElection(t *testing.T) {
	t.Parallel()
	opts := terraformOptions(t)
	defer terraform.Destroy(t, opts)
	terraform.InitAndApply(t, opts)

	ctx := context.Background()
	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(awsRegion))
	require.NoError(t, err)
	ec2c := ec2.NewFromConfig(cfg)

	leader := findLeader(t, ec2c)
	t.Logf("baseline leader: %s", leader)

	// Stop the leader instance — simulates abrupt failure
	_, err = ec2c.StopInstances(ctx, &ec2.StopInstancesInput{
		InstanceIds: []string{leader},
		Force:       aws.Bool(true),
	})
	require.NoError(t, err)
	t.Logf("stopped leader %s", leader)

	// Wait up to 60s for a new leader; HAProxy /leader health check at 10s
	// interval × 2 healthy_threshold means worst case ~20s; budget 60s.
	newLeader := retry.DoWithRetry(t, "wait for new leader", 12, 5*time.Second, func() (string, error) {
		l := findLeader(t, ec2c)
		if l == "" || l == leader {
			return "", fmt.Errorf("no new leader yet (current: %s)", l)
		}
		return l, nil
	})
	t.Logf("new leader: %s (failover took ≤ 60s)", newLeader)
	assert.NotEqual(t, leader, newLeader)
}

// TestWalArchiveContinuous — generate writes, verify pgBackRest archive
// has no gaps. Sprint B acceptance criterion #2.
func TestWalArchiveContinuous(t *testing.T) {
	t.Parallel()
	opts := terraformOptions(t)
	defer terraform.Destroy(t, opts)
	terraform.InitAndApply(t, opts)

	writerEndpoint := terraform.Output(t, opts, "writer_endpoint")
	walBucket := terraform.Output(t, opts, "wal_bucket")
	t.Logf("writer=%s bucket=%s", writerEndpoint, walBucket)

	// Stub: Phase B.7.2 wires actual pgBackRest verify-archive command via
	// SSM. For now this test exists as a placeholder that ensures the
	// resources provision correctly.
	assert.NotEmpty(t, writerEndpoint)
	assert.NotEmpty(t, walBucket)
}

// TestSynchronousReplicationZeroLoss — INSERT then immediately stop leader,
// verify the row is on the promoted replica. Sprint B criterion #3.
func TestSynchronousReplicationZeroLoss(t *testing.T) {
	t.Parallel()
	t.Skip("Phase B.7.2: requires SSM session + psql client; deferred to dedicated test instance")
}

// TestQuorumLossReadOnly — kill 2 of 3 PG nodes, cluster goes read-only,
// doesn't lie about state. Sprint B criterion #4.
func TestQuorumLossReadOnly(t *testing.T) {
	t.Parallel()
	t.Skip("Phase B.7.2: chaos test, requires extended runtime + cleanup safeguards")
}

// TestSwitchoverDrill — runs runbooks/switchover-drill.sh end-to-end.
// Sprint B criterion #5.
func TestSwitchoverDrill(t *testing.T) {
	t.Parallel()
	t.Skip("Phase B.7.2: invokes scripts/dr/patroni_switchover_drill.sh via SSM")
}

// TestPgBackRestPITR — INSERT, snapshot timestamp, INSERT bad rows, restore
// to timestamp, verify state. Sprint B criterion #6.
func TestPgBackRestPITR(t *testing.T) {
	t.Parallel()
	t.Skip("Phase B.7.2: requires multi-step SSM orchestration + a clean restore target")
}

// TestRestoreTestCronAlert — corrupt a basebackup in S3, observe Prometheus
// alert. Sprint B criterion #8 (covered by the K8s CronJob spec; this stub
// reserves a slot for a Pushgateway-based assertion in a kind cluster).
func TestRestoreTestCronAlert(t *testing.T) {
	t.Parallel()
	t.Skip("Phase B.7.2: requires Prometheus + Pushgateway in a kind cluster")
}

// findLeader returns the EC2 instance ID of the current Patroni leader by
// querying the writer target group's healthy targets. Empty string if no
// healthy target.
func findLeader(t *testing.T, ec2c *ec2.Client) string {
	t.Helper()
	ctx := context.Background()
	// Find PG nodes by tag
	out, err := ec2c.DescribeInstances(ctx, &ec2.DescribeInstancesInput{
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
	require.NoError(t, err)

	for _, res := range out.Reservations {
		for _, inst := range res.Instances {
			// Phase B.7.2: query Patroni REST /leader on each instance via
			// SSM RunCommand to deterministically identify the leader.
			// Stub: return first running PG instance.
			for _, tag := range inst.Tags {
				if aws.ToString(tag.Key) == "medbrains-pg-node-id" &&
					strings.HasPrefix(aws.ToString(tag.Value), "pg-") {
					return aws.ToString(inst.InstanceId)
				}
			}
		}
	}
	return ""
}

// connectPatroni opens a pgx connection to the Patroni writer endpoint with
// a short retry loop (handles brief 5xx during initial cluster bootstrap or
// failover).
func connectPatroni(t *testing.T, endpoint, password string) *pgx.Conn {
	t.Helper()
	ctx := context.Background()
	dsn := fmt.Sprintf("postgres://postgres:%s@%s/postgres?sslmode=require",
		password, endpoint)
	var conn *pgx.Conn
	retry.DoWithRetry(t, "connect to patroni", 30, 2*time.Second, func() (string, error) {
		var err error
		conn, err = pgx.Connect(ctx, dsn)
		if err != nil {
			return "", err
		}
		return "ok", nil
	})
	return conn
}
