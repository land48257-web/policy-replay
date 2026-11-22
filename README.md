# Policy Replay

Policy Replay lets a warehouse process reviewer hold a case fixed while testing two revisions of a written rule. OCR reads each scan in the browser. Select the same damaged return with no photo: the first revision has no matching instruction; the second routes it to the Receiving Supervisor. **Show on scan** highlights the sentence supporting the selected result. The photo-attached control goes to Quality Inspection in both versions.

## Try it

1. Choose **Load built-in example scans**. Both are fictional and were made for the demo.
2. Select **Damaged return without photo** and compare the two outcomes.
3. Select source **V2**, then choose **Show on scan** to inspect the actual clause.
4. Switch to **Damaged return with photo** for the unchanged control.

You can also replace either scan with a local PNG or JPEG. Uploaded scan contents are not sent to a server; the app downloads only its static assets from the host. The current demo reads a narrow English sentence pattern for two fixed cases. A matching line is reviewable evidence, not a policy approval or a guarantee of OCR accuracy.

## Build and test

With Node.js 24 or later and npm:

~~~sh
npm ci
npm run dev
~~~

Open http://127.0.0.1:5173/. To check a release:

~~~sh
npm test
npm run typecheck
npm run build
npm run check:hosting
npm run smoke
~~~

The Chrome smoke check uses an installed Chrome and serves the production build under a nested URL. See the [runbook](docs/RUNBOOK.md) for details. GitHub Pages can serve the generated dist directory under the project path using the manual Pages workflow; the source repository does not include generated OCR files or build output.

## Built with Kiro

The [Quick Spec](.kiro/specs/policy-replay/) documents the requirements, design, and task list used to build the local prototype. Separating a missing rule from an unreadable scan and binding evidence to its source revision became explicit implementation and test requirements.

The project code is [MIT licensed](LICENSE). The self-hosted OCR components, their data and bundled dependencies have their own [notices](THIRD_PARTY_NOTICES.md).
