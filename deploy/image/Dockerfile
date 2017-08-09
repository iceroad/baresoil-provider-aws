FROM ubuntu:xenial
MAINTAINER contact@iceroad.io
RUN \
  apt-get update && \
  apt-get upgrade -y && \
  apt-get install -y  \
    curl fakechroot fakeroot \
    npm git \
    imagemagick \
    build-essential \
    && \
  npm install -g n npm && \
  n latest && \
  cp $(which node) /usr/bin/node-latest && \
  n lts && \
  cp $(which node) /usr/bin/node-lts && \
  n stable && \
  cp $(which node) /usr/bin/node-stable && \
  adduser --gecos sandbox --no-create-home --disabled-password --disabled-login --shell /bin/false sandbox && \
  apt-get autoremove -y && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/*
