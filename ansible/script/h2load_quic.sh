sudo apt install \
  clang ruby \
  autoconf automake autotools-dev libtool pkg-config \
  libelf-dev zlib1g-dev libcunit1-dev libssl-dev libxml2-dev libevent-dev libc-ares-dev libjansson-dev libsystemd-dev libev-dev

mkdir -p ~/quic
cd ~/quic

# Build custom OpenSSL
git clone --depth 1 -b OpenSSL_1_1_1q+quic https://github.com/quictls/openssl
cd openssl
./config --prefix="$PWD"/build --openssldir=/etc/ssl
make -j"$(nproc)"
make install_sw
cd ..

# Build nghttp3
git clone --depth 1 -b v0.7.1 https://github.com/ngtcp2/nghttp3
cd nghttp3
autoreconf -i
./configure --prefix="$PWD"/build --enable-lib-only
make -j"$(nproc)"
make install
cd ..

# Build ngtcp2
git clone --depth 1 -b v0.10.0 https://github.com/ngtcp2/ngtcp2
cd ngtcp2
autoreconf -i
./configure --prefix="$PWD"/build --enable-app \
      PKG_CONFIG_PATH="$PWD/../openssl/build/lib/pkgconfig"
make -j"$(nproc)"
make install
cd ..

# Build libbpf-dev
git clone --depth 1 -b v1.0.0 https://github.com/libbpf/libbpf
cd libbpf
PREFIX=$PWD/build make -C src install
cd ..

# Build nghttp2
git clone https://github.com/nghttp2/nghttp2
cd nghttp2
git submodule update --init
autoreconf -i
./configure \
      --prefix="$PWD/build" \
      --enable-http3 --enable-app --with-mruby --with-neverbleed --with-libbpf \
      --disable-python-bindings \
      CC=clang-14 CXX=clang++-14 \
      PKG_CONFIG_PATH="$PWD/../openssl/build/lib/pkgconfig:$PWD/../nghttp3/build/lib/pkgconfig:$PWD/../ngtcp2/build/lib/pkgconfig:$PWD/../libbpf/build/lib64/pkgconfig" \
      LDFLAGS="$LDFLAGS -Wl,-rpath,$PWD/../openssl/build/lib -Wl,-rpath,$PWD/../libbpf/build/lib64"
make -j"$(nproc)"
make install

ln -s -f ~/quic/nghttp2/build/bin/h2load ~/.local/bin/h2load
