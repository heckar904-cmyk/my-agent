{ pkgs }: {
  deps = [
    pkgs.nodejs_20
    pkgs.nodePackages.npm
    pkgs.ffmpeg
    pkgs.python3
  ];
}
