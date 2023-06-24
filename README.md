# Bondifuzz

Prerequisites:
- [docker-compose v1.29.2](https://github.com/docker/compose/releases/tag/1.29.2)
- [kind](https://kind.sigs.k8s.io/docs/user/quick-start/#installation)
- [kubectl](https://kubernetes.io/docs/tasks/tools)
- [rust](https://www.rust-lang.org/tools/install)
- [upx](https://upx.github.io/)

# Installation

Download repository:

```bash
git clone https://github.com/Bondifuzz/bondifuzz-in-kind.git
cd bondifuzz-in-kind
```

## Sandbox binaries

Compile sandbox binaries:

```bash
git clone https://github.com/Bondifuzz/agents/sbxbin-monitor.git build/sandbox_binaries/monitor
RUSTFLAGS='-C target-feature=+crt-static' cargo build \
	--manifest-path=build/sandbox_binaries/monitor/Cargo.toml \
	--release --target x86_64-unknown-linux-gnu

upx build/sandbox_binaries/monitor/target/x86_64-unknown-linux-gnu/release/monitor \
	-9 -o build/sandbox_binaries/monitor/monitor

git clone https://github.com/Bondifuzz/agents/sbxbin-runner.git build/sandbox_binaries/runner
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

## Agent images

Prepare agent images:

```bash
# Build LibFuzzer agent
git clone https://github.com/Bondifuzz/agents/libfuzzer-agent.git build/agents/libfuzzer-agent
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
git clone https://github.com/Bondifuzz/agents/afl-agent.git build/agents/afl-agent
docker build -t bondifuzz/agents/afl build/agents/afl-agent

docker tag bondifuzz/agents/afl localhost:5000/agents/afl
docker push localhost:5000/agents/afl

docker tag bondifuzz/agents/afl localhost:5000/agents/afl.rs
docker push localhost:5000/agents/afl.rs
```

## User images (Sandbox)

Prepare default user images:

```bash
git clone https://github.com/Bondifuzz/agents/default-images.git build/sandbox/default-images

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

## Services

Download repositories:

```bash
git clone https://github.com/Bondifuzz/api-gateway.git build/services/api-gateway
git clone https://github.com/Bondifuzz/scheduler.git build/services/scheduler
git clone https://github.com/Bondifuzz/starter.git build/services/starter
git clone https://github.com/Bondifuzz/crash-analyzer.git build/services/crash-analyzer
git clone https://github.com/Bondifuzz/pool-manager-stub.git build/services/pool-manager
```

Push additional images to private registry:

```bash
docker pull busybox
docker tag busybox localhost:5000/starter-test-run
docker push localhost:5000/starter-test-run
```

Deploy bondifuzz services:

```bash
docker-compose build
docker-compose -p bondifuzz up -d
```

Now host at `http://localhost:8080` must be available

## Install CLI

```bash
git clone https://github.com/Bondifuzz/bondi-python.git build/ui/bondi-python
pip install build/ui/bondi-python
```