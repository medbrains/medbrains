module github.com/medbrains/infra/test/patroni

go 1.22

require (
	github.com/aws/aws-sdk-go-v2 v1.30.0
	github.com/aws/aws-sdk-go-v2/config v1.27.0
	github.com/aws/aws-sdk-go-v2/service/ec2 v1.165.0
	github.com/aws/aws-sdk-go-v2/service/s3 v1.55.0
	github.com/aws/aws-sdk-go-v2/service/ssm v1.51.0
	github.com/gruntwork-io/terratest v0.46.16
	github.com/jackc/pgx/v5 v5.5.5
	github.com/stretchr/testify v1.9.0
)
