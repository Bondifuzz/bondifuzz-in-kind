# Bondifuzz

Prerequisites:
- An instance with a minimum of 8 cores and 8 GB of RAM and Ubuntu/Debian operating system
- [docker-compose v1.29.2](https://github.com/docker/compose/releases/tag/1.29.2)
- [kind](https://kind.sigs.k8s.io/docs/user/quick-start/#installation)
- [kubectl](https://kubernetes.io/docs/tasks/tools)
- [rust](https://www.rust-lang.org/tools/install)
- [upx](https://upx.github.io/)

# Installation

**WARNING**: We do not recommend to expose the deployment to the internet

Download deployment repository:

```bash
git clone https://github.com/Bondifuzz/bondifuzz-in-kind.git
cd bondifuzz-in-kind
```

Download repositories of the services:

```bash
# Services
git clone https://github.com/Bondifuzz/api-gateway.git build/services/api-gateway
git clone https://github.com/Bondifuzz/scheduler.git build/services/scheduler
git clone https://github.com/Bondifuzz/starter.git build/services/starter
git clone https://github.com/Bondifuzz/crash-analyzer.git build/services/crash-analyzer
git clone https://github.com/Bondifuzz/pool-manager-stub.git build/services/pool-manager
git clone https://github.com/Bondifuzz/sbxbin-monitor.git build/sandbox_binaries/monitor
git clone https://github.com/Bondifuzz/sbxbin-runner.git build/sandbox_binaries/runner
git clone https://github.com/Bondifuzz/libfuzzer-agent.git build/agents/libfuzzer-agent
git clone https://github.com/Bondifuzz/afl-agent.git build/agents/afl-agent
git clone https://github.com/Bondifuzz/default-images.git build/sandbox/default-images
git clone https://github.com/Bondifuzz/bondi-python.git build/ui/bondi-python
```

## Sandbox binaries

Compile sandbox binaries:

```bash
RUSTFLAGS='-C target-feature=+crt-static' cargo build \
	--manifest-path=build/sandbox_binaries/monitor/Cargo.toml \
	--release --target x86_64-unknown-linux-gnu

upx build/sandbox_binaries/monitor/target/x86_64-unknown-linux-gnu/release/monitor \
	-9 -o build/sandbox_binaries/monitor/monitor

RUSTFLAGS='-C target-feature=+crt-static' cargo build \
	--manifest-path=build/sandbox_binaries/runner/Cargo.toml \
	--release --target x86_64-unknown-linux-gnu

upx build/sandbox_binaries/runner/target/x86_64-unknown-linux-gnu/release/runner \
	-9 -o build/sandbox_binaries/runner/runner
```

## Kind cluster

Create kind cluster:

```bash
kind create cluster --config kind.yaml
cat ~/.kube/config | sed "s/server:.*/server: https:\/\/bondifuzz-control-plane:6443/g" > ./bondifuzz/services/starter/kube_config.yaml
```

Create necessary objects:

```bash
# Sandbox binaries, config, agent logging settings
kubectl create configmap runner-binary --from-file=build/sandbox_binaries/runner/runner
kubectl create configmap monitor-binary --from-file=build/sandbox_binaries/monitor/monitor
kubectl create configmap monitor-config --from-file=bondifuzz/sandbox_binaries/monitor/config.json
kubectl create configmap agent-logging-settings --from-file=bondifuzz/agent/logging.yaml

# Permissions for agent
kubectl create serviceaccount bondifuzz-agent
kubectl create role bondifuzz-agent --verb="get" --resource="pods,pods/log,pods/exec"
kubectl create rolebinding bondifuzz-agent --role=bondifuzz-agent --serviceaccount=default:bondifuzz-agent
```

## Private Container registry

Deploy private container registry

```bash
docker-compose -p bondifuzz up -d registry
```

Push agent images:

```bash
# Build LibFuzzer agent
docker build -t bondifuzz/agents/libfuzzer build/agents/libfuzzer-agent

docker tag bondifuzz/agents/libfuzzer localhost:5000/agents/libfuzzer
docker push localhost:5000/agents/libfuzzer

docker tag bondifuzz/agents/libfuzzer localhost:5000/agents/jazzer
docker push localhost:5000/agents/jazzer

docker tag bondifuzz/agents/libfuzzer localhost:5000/agents/atheris
docker push localhost:5000/agents/atheris

docker tag bondifuzz/agents/libfuzzer localhost:5000/agents/cargo-fuzz
docker push localhost:5000/agents/cargo-fuzz

docker tag bondifuzz/agents/libfuzzer localhost:5000/agents/go-fuzz-libfuzzer
docker push localhost:5000/agents/go-fuzz-libfuzzer

# Build AFL agent
docker build -t bondifuzz/agents/afl build/agents/afl-agent

docker tag bondifuzz/agents/afl localhost:5000/agents/afl
docker push localhost:5000/agents/afl

docker tag bondifuzz/agents/afl localhost:5000/agents/afl.rs
docker push localhost:5000/agents/afl.rs
```

Prepare default user images (sandbox images):

```bash
# Default user image: Ubuntu 18.04
docker build \
	-f build/sandbox/default-images/ubuntu_18.04.dockerfile \
	-t bondifuzz/sandbox/ubuntu-18.04 \
	build/sandbox/default-images

docker tag bondifuzz/sandbox/ubuntu-18.04 localhost:5000/sandbox/ubuntu-18.04
docker push localhost:5000/sandbox/ubuntu-18.04

# Default user image: Ubuntu 20.04
docker build \
	-f build/sandbox/default-images/ubuntu_20.04.dockerfile \
	-t bondifuzz/sandbox/ubuntu-20.04 \
	build/sandbox/default-images

docker tag bondifuzz/sandbox/ubuntu-20.04 localhost:5000/sandbox/ubuntu-20.04
docker push localhost:5000/sandbox/ubuntu-20.04

# Default user image: Ubuntu 22.04
docker build \
	-f build/sandbox/default-images/ubuntu_22.04.dockerfile \
	-t bondifuzz/sandbox/ubuntu-22.04 \
	build/sandbox/default-images

docker tag bondifuzz/sandbox/ubuntu-22.04 localhost:5000/sandbox/ubuntu-22.04
docker push localhost:5000/sandbox/ubuntu-22.04
```


Push additional images to the private registry:

```bash
docker pull busybox
docker tag busybox localhost:5000/starter-test-run
docker push localhost:5000/starter-test-run
```

## Resource pool setup

Make the necessary edits to the `node_cpu` and `node_ram` fields in the `pools.yaml` file. Ensure that a minimum of 4 cores and 4GB of RAM are reserved for system usage. The remaining resources can be allocated for fuzzing. Once you have made these adjustments, update the `pools.yaml` file accordingly.

Full path to the file:
```
bondifuzz/infra/arangodb/initdb.d/pools.yaml
```

## Services

Modify credentials of the system users:

```bash
export CHARS="0-9a-zA-Z_\-;.,%$"
cat /dev/urandom | tr -dc $CHARS | head -c 22 > password_bondi_user.txt
cat /dev/urandom | tr -dc $CHARS | head -c 22 > password_bondi_admin.txt

export ENVFILE=./bondifuzz/services/api-gateway/.env
sed -i "s/DEFAULT_ACCOUNT_PASSWORD=.*/DEFAULT_ACCOUNT_PASSWORD=`cat password_bondi_user.txt`/g" $ENVFILE
sed -i "s/SYSTEM_ADMIN_PASSWORD=.*/SYSTEM_ADMIN_PASSWORD=`cat password_bondi_admin.txt`/g" $ENVFILE
```

Deploy bondifuzz services:

```bash
docker-compose build
docker-compose -p bondifuzz up -d
```

Now host at `http://localhost:8080` must be available

## Install CLI

```bash
pip install build/ui/bondi-python
bondi config init \
    --server-url "http://127.0.0.1:8080" \
    --username root \
    --password `cat password_bondi_admin.txt`

bondi admin users list
# +------+------------+----------------+------------------------+---------+
# |   ID | Username   | Display name   | Email                  | Admin   |
# |------+------------+----------------+------------------------+---------|
# | 1238 | root       | Root           | ff.admin@example.com   | True    |
# | 1242 | default    | Default        | ff.default@example.com | False   |
# +------+------------+----------------+------------------------+---------+
```
