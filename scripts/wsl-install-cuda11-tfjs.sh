#!/usr/bin/env bash
# CUDA 11.8 + cuDNN 8 for @tensorflow/tfjs-node-gpu 4.22 (expects libcudart.so.11, libcudnn.so.8).
set -eu

if ! grep -qiE 'microsoft|wsl' /proc/version 2>/dev/null; then
  echo "Run inside WSL (Ubuntu)."
  exit 1
fi

echo "==> tfjs-node-gpu 4.22 needs CUDA 11.x + cuDNN 8 (not Ubuntu's default CUDA 12 toolkit)."
echo "    nvidia-smi alone is not enough — TensorFlow must dlopen libcudart.so.11.0 and libcudnn.so.8."
echo ""

if ldconfig -p 2>/dev/null | grep -q 'libcudart.so.11'; then
  echo "libcudart.so.11 already visible to ldconfig."
  ldconfig -p | grep -E 'libcudart.so.11|libcudnn.so.8' || true
  exit 0
fi

echo "Install NVIDIA CUDA 11.8 for WSL-Ubuntu (requires sudo), then cuDNN 8 for CUDA 11."
echo ""
echo "1) CUDA 11.8 local repo (from NVIDIA archive — pick WSL-Ubuntu, deb local):"
echo "   https://developer.nvidia.com/cuda-11-8-0-download-archive"
echo ""
echo "   Example (adjust .deb name if NVIDIA updates the pin file):"
echo "   wget https://developer.download.nvidia.com/compute/cuda/repos/wsl-ubuntu/x86_64/cuda-wsl-ubuntu.pin"
echo "   sudo mv cuda-wsl-ubuntu.pin /etc/apt/preferences.d/cuda-repository-pin-600"
echo "   wget https://developer.download.nvidia.com/compute/cuda/11.8.0/local_installers/cuda-repo-wsl-ubuntu-11-8-local_11.8.0-1_amd64.deb"
echo "   sudo dpkg -i cuda-repo-wsl-ubuntu-11-8-local_11.8.0-1_amd64.deb"
echo "   sudo cp /var/cuda-repo-wsl-ubuntu-11-8-local/cuda-*-keyring.gpg /usr/share/keyrings/"
echo "   sudo apt-get update"
echo "   sudo apt-get -y install cuda-toolkit-11-8"
echo ""
echo "2) cuDNN 8 for CUDA 11 (NVIDIA developer account):"
echo "   https://developer.nvidia.com/rdp/cudnn-archive"
echo "   Install libcudnn8 packages into the same Ubuntu instance."
echo ""
echo "3) Library path (add to ~/.bashrc or let start-wsl-tf.sh export it):"
echo "   export LD_LIBRARY_PATH=/usr/local/cuda-11.8/lib64:/usr/lib/wsl/lib:\$LD_LIBRARY_PATH"
echo ""
echo "4) Rebuild native binding in this repo (WSL only, Node 20):"
echo "   cd \"$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)\""
echo "   source \"\$NVM_DIR/nvm.sh\" && nvm use 20"
echo "   npm rebuild @tensorflow/tfjs-node-gpu"
echo ""
echo "5) Smoke test:"
echo "   TFJS_BACKEND=gpu npm run start:node"
echo "   Look for NO 'Skipping registering GPU devices' and GPU memory use in nvidia-smi during training."
echo ""
echo "Note: tfjs-node-gpu bundles TensorFlow 2.9. Very new GPUs (e.g. RTX 50-series) may still be unsupported;"
echo "      if CUDA 11 is installed but no GPU registers, use the Python template (tensorflow[and-cuda]) for workshop GPU."
