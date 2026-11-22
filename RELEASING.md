# Releasing View Me Claude

## Each release

1. Raise `"version"` in `package.json` and add a line to `CHANGELOG.md`.
2. On GitHub: Releases → Draft a new release → new tag `v<version>` → Publish.
3. GitHub tests it, attaches `view-me-claude.vsix` to the release, and publishes to the VS Code
   Marketplace and Open VSX when their tokens are set (below). Watch it under Actions.

## First time on the VS Code Marketplace (no token needed)

1. Sign in at https://marketplace.visualstudio.com/manage with a Microsoft account.
2. Create a publisher with the ID **buggypather** (it must match `"publisher"` in package.json).
3. **New extension → Visual Studio Code**, and upload the `.vsix` (from the release, or
   `npm run package`). It's checked for a few minutes, then appears in VS Code's Extensions panel.

Later versions can be uploaded the same way (the extension's **…** → Update), or automatically:
create a Personal Access Token in Azure DevOps (https://dev.azure.com → User settings → Personal
access tokens; Organization: All accessible organizations; Scopes: Marketplace → Manage) and save
it in this repo as the Actions secret `VSCE_PAT`.

## First time on Open VSX (VSCodium, Cursor, Gitpod…)

1. Sign in at https://open-vsx.org with GitHub, and sign the publisher agreement in your profile.
2. Profile → Access Tokens → Generate, then create the namespace once:
   `npx ovsx create-namespace buggypather -p <token>`.
3. Publish: `npx ovsx publish view-me-claude.vsix -p <token>`, or save the token in this repo as
   the Actions secret `OVSX_PAT` and releases publish there by themselves.
