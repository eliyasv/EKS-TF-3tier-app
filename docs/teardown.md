# Ordered dev teardown

Deleting EKS alone does not delete every AWS resource created by Kubernetes,
Helm, eksctl or the console. In the tested deployment, an Argo CD Service changed
to `LoadBalancer` created a Classic Load Balancer. It kept public subnets and the
internet gateway attached after EKS deletion. Its security group and the manually
created jump-server group then blocked VPC deletion.

These steps delete database data and monitoring history. Save dashboard JSON and any database backup you want to preserve first. Keep the state bucket and locking resources
until teardown is complete; retain them for future redeployments if desired.

## 1. Inventory while EKS is live

Run Kubernetes commands on the jump server; run AWS commands with the project
account/region selected. Capture the VPC ID before deleting the cluster:

```bash
aws sts get-caller-identity
PROJECT_VPC_ID=$(aws eks describe-cluster --region us-east-1 \
  --name ignite-cluster-dev --query 'cluster.resourcesVpcConfig.vpcId' --output text)
echo "$PROJECT_VPC_ID"
kubectl get ingress,services -A
kubectl get pv
aws elbv2 describe-load-balancers --region us-east-1 \
  --query "LoadBalancers[?VpcId=='$PROJECT_VPC_ID'].{Name:LoadBalancerName,ARN:LoadBalancerArn,DNS:DNSName}"
aws elb describe-load-balancers --region us-east-1 \
  --query "LoadBalancerDescriptions[?VPCId=='$PROJECT_VPC_ID'].{Name:LoadBalancerName,DNS:DNSName}"
```

`elbv2` lists ALBs/NLBs; `elb` lists Classic Load Balancers. Check both.
Record manually created EC2 instances, IAM policies, eksctl stacks, security
groups, VPC endpoints, EIPs and any retained EBS volumes.

## 2. Disable GitOps recreation

```bash
kubectl patch application mern-app -n argocd --type=merge \
  -p '{"spec":{"syncPolicy":{"automated":null}}}'
kubectl patch application monitoring -n argocd --type=merge \
  -p '{"spec":{"syncPolicy":{"automated":null}}}'
kubectl get applications mern-app monitoring -n argocd \
  -o jsonpath='{range .items[*]}{.metadata.name}{" automated="}{.spec.syncPolicy.automated}{"\n"}{end}'
```

Expect empty automated values. Wait for any in-flight sync operation to finish.
Do not manually sync or reapply the Application YAML during teardown. If a
parent Application manages these objects, disable that reconciliation too.

## 3. Remove load balancers before their controllers

```bash
kubectl delete ingress mern-ingress -n mern-app --timeout=180s
kubectl get services -A
```

For Argo CD, only if its Service is `LoadBalancer`, change it to ClusterIP while
EKS is still live (or delete the Service if no longer needed):

```bash
kubectl patch service argocd-server -n argocd --type=merge \
  -p '{"spec":{"type":"ClusterIP"}}'
```

Do the equivalent for other project LoadBalancer Services. Keep the AWS Load
Balancer Controller running and wait for AWS deletion to finish. Repeat both
AWS load-balancer listings from step 1 until project entries disappear. If
Kubernetes deletion hangs, inspect controller logs/events instead of stripping
finalizers. Save the load balancer names and security groups for the final check.

## 4. Remove workloads and storage

```bash
kubectl delete namespace mern-app monitoring logging --timeout=300s
kubectl get namespaces
kubectl get pv
```

Keep EBS CSI running in kube-system until volumes are deleted. A PV with reclaim
policy `Retain` needs separate handling. Confirm the associated AWS EBS volume
IDs are removed; an empty PV list alone is not a complete AWS inventory.

## 5. Remove the eksctl-managed controller role

Once load balancers are gone, delete the IAM service account if it was created
with eksctl:

```bash
eksctl delete iamserviceaccount --cluster ignite-cluster-dev \
  --region us-east-1 --namespace kube-system \
  --name aws-load-balancer-controller --wait
aws cloudformation describe-stacks --region us-east-1 \
  --stack-name eksctl-ignite-cluster-dev-addon-iamserviceaccount-kube-system-aws-load-balancer-controller \
  --query 'Stacks[0].StackStatus' --output text
```

A missing stack confirms deletion. A separately created
`AWSLoadBalancerControllerIAMPolicy` may remain; inspect its attachments and
remove it only if dedicated to this deleted setup. Do not delete shared IAM roles.

## 6. Destroy from outside the cluster VPC

Finish all jump-server work first. If manually created, terminate that instance
and remove its dedicated security group/EIP after dependencies clear. It is
outside Terraform and its interface can block subnet deletion. The SSM session
ends when it terminates. A Terraform-managed instance should be removed by its
own configuration/state.

Run the infra Jenkins destroy workflow from a host outside this VPC, or use a
properly authenticated laptop. Keep that execution host alive until the destroy
finishes. From the infrastructure repository root, the CLI equivalent is:

```bash
cp environments/dev/backend.tf ./backend.tf
terraform init -reconfigure
terraform plan -destroy -var-file=environments/dev/dev.tfvars -out=destroy-dev.tfplan
# Review the plan before the next command:
terraform apply destroy-dev.tfplan
terraform state list
```

Use the correct backend and dev state; do not run from the tfvars-only environment
folder. An empty state list after a successful destroy confirms that state's
managed resources are gone, not that the entire AWS account is empty.

## If destroy is stuck

Do not start a second destroy while one is running. From the outside host,
set `PROJECT_VPC_ID` to the recorded VPC ID and inspect dependencies:

```bash
aws ec2 describe-network-interfaces --region us-east-1 \
  --filters "Name=vpc-id,Values=$PROJECT_VPC_ID" \
  --query 'NetworkInterfaces[].{ID:NetworkInterfaceId,Description:Description,Instance:Attachment.InstanceId,PublicIP:Association.PublicIp,Status:Status}'
aws ec2 describe-security-groups --region us-east-1 \
  --filters "Name=vpc-id,Values=$PROJECT_VPC_ID" \
  --query 'SecurityGroups[].{ID:GroupId,Name:GroupName,Description:Description}'
aws ec2 describe-vpc-endpoints --region us-east-1 \
  --filters "Name=vpc-id,Values=$PROJECT_VPC_ID"
```

Identify the owning resource before deleting an interface. An orphaned Classic
Load Balancer must be deleted through `aws elb delete-load-balancer` using its
confirmed name; an ALB/NLB uses `aws elbv2 delete-load-balancer` with its ARN.
AWS removes the service-managed interfaces afterward.

Once interfaces are gone, leftover non-default security groups may still block
the VPC. Confirm each belongs to this project, is unused and is not referenced
by another security group's rules before deleting it with
`aws ec2 delete-security-group --group-id <confirmed-group-id>` (replace the
placeholder). Leave the VPC's default group alone. DependencyViolation means
something still references the resource. Terraform may continue after cleanup;
if the run has already failed, rerun a fresh dev destroy after removing blockers.

## Final inventory

In us-east-1, check project EC2 instances, EBS volumes/snapshots, Classic and
ALB/NLB load balancers, NAT gateways, Elastic IPs, endpoints, IAM roles/policies,
CloudFormation stacks, CloudWatch log groups, ECR repositories/images and Secrets
Manager secrets. Check other regions if resources were created there.

Jenkins/SonarQube is separately provisioned: save its configuration/logs before
terminating it and inspect its disk deletion settings. Manually created MongoDB
Secrets Manager values are not deleted by Terraform. Retain if needed for saved
data, otherwise schedule deletion with a recovery window (for example seven
days) rather than immediate force deletion. ECR images can be kept
for redeployment. Delete backend resources only as an explicit final retirement
step after all relevant states/resources are accounted for.

References: [VPC dependency cleanup](https://repost.aws/knowledge-center/troubleshoot-dependency-error-delete-vpc)
and [internet gateway deletion](https://docs.aws.amazon.com/vpc/latest/userguide/delete-igw.html).
