/** @format */
{
  pkgs ? import <nixpkgs> { },
  pkgsLinux ? import <nixpkgs> { system = "x86_64-linux"; },
  publicSupabaseUrl ? "",
  publicSupabasePublishableKey ? "",
  publicSentryDsn ? "",
  publicCdnBaseUrl ? "",
  publicTurnstileSiteKey ? "",
}:

let
  linuxPkgs = pkgsLinux;

  bun = linuxPkgs.bun;
  nodejs = linuxPkgs.nodejs_26;
  src = pkgs.lib.cleanSourceWith {
    src = ./.;
    filter =
      path: type:
      let
        base = baseNameOf path;
        isEnvSecret =
          (base == ".env" || pkgs.lib.hasPrefix ".env." base)
          && !(builtins.elem base [
            ".env.example"
            ".env.production.example"
            ".env.preview.example"
            ".env.test"
          ]);
      in
      !isEnvSecret
      && !(builtins.elem base [
        ".git"
        ".svelte-kit"
        "node_modules"
        ".wrangler"
        "graphify-out"
        ".agents"
        ".claude"
        ".codex"
        ".serena"
        "dist"
        "supabase"
      ]);
  };

  fkpBuild = linuxPkgs.stdenv.mkDerivation {
    pname = "fkp-www";
    version = "0.0.1";
    inherit src;

    nativeBuildInputs = [
      bun
      nodejs
    ];

    buildPhase = ''
      export HOME=$(mktemp -d)
      export BUN_INSTALL_CACHE_DIR=$(mktemp -d)
      export PUBLIC_SUPABASE_URL=${pkgs.lib.escapeShellArg publicSupabaseUrl}
      export PUBLIC_SUPABASE_PUBLISHABLE_KEY=${pkgs.lib.escapeShellArg publicSupabasePublishableKey}
      export PUBLIC_SENTRY_DSN=${pkgs.lib.escapeShellArg publicSentryDsn}
      export PUBLIC_CDN_BASE_URL=${pkgs.lib.escapeShellArg publicCdnBaseUrl}
      export PUBLIC_TURNSTILE_SITE_KEY=${pkgs.lib.escapeShellArg publicTurnstileSiteKey}
      bun install --frozen-lockfile
      bun run build
    '';

    installPhase = ''
      mkdir -p $out
      cp -r .svelte-kit/cloudflare $out/cloudflare
      cp -r node_modules $out/node_modules
      cp wrangler.jsonc $out/
      cp package.json bun.lock bunfig.toml $out/
    '';
  };

  entrypoint = linuxPkgs.writeShellScript "entrypoint" ''
    exec ${bun}/bin/bunx wrangler pages dev /app/cloudflare --port 8788
  '';

in
linuxPkgs.dockerTools.buildLayeredImage {
  name = "fkp-www";
  tag = "latest";

  contents = [
    linuxPkgs.dockerTools.caCertificates
    bun
    nodejs
  ];

  fakeRootCommands = ''
    mkdir -p /app
    cp -r ${fkpBuild}/cloudflare /app/cloudflare
    cp -r ${fkpBuild}/node_modules /app/node_modules
    cp ${fkpBuild}/wrangler.jsonc /app/wrangler.jsonc
    cp ${fkpBuild}/package.json /app/package.json
    cp ${fkpBuild}/bun.lock /app/bun.lock
    cp ${fkpBuild}/bunfig.toml /app/bunfig.toml
    chmod -R 755 /app
  '';

  config = {
    Cmd = [ "${entrypoint}" ];
    ExposedPorts = {
      "8788/tcp" = { };
    };
    WorkingDir = "/app";
    Env = [
      "NODE_ENV=production"
    ];
  };
}
