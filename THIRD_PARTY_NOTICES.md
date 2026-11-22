# Third-party notices

The [MIT license](LICENSE) applies to original Policy Replay code and fictional fixtures. It does not relicense the OCR engine, model, or dependencies. The Git source tree excludes generated OCR packages. Installation copies the following notices with the npm-provided browser artifacts so they remain available in the hosted production build.

| Component | Provenance and license |
| --- | --- |
| Tesseract.js and its browser worker, 7.0.0 | [Naptha Tesseract.js](https://github.com/naptha/tesseract.js/tree/v7.0.0), Apache-2.0. See the [project license](licenses/tesseract-js-Apache-2.0.txt) and the [browser](licenses/tesseract-browser-bundle-notices.txt) and [worker](licenses/tesseract-worker-bundle-notices.txt) bundle notices. |
| Tesseract.js-core browser WebAssembly, 7.0.0 | [Naptha Tesseract.js-core](https://github.com/naptha/tesseract.js-core/tree/v7.0.0), Apache-2.0. See the [core license](licenses/tesseract-js-core-Apache-2.0.txt), [pinned engine license](licenses/tesseract-engine-Apache-2.0.txt), and component notices below. |
| English 4.0.0 trained data | Gzipped upstream Tesseract English data from npm package @tesseract.js-data/eng 1.0.0. [Naptha documents its TessData provenance](https://github.com/naptha/tessdata#sources). The [upstream Tesseract OCR model](https://github.com/tesseract-ocr/tessdata) is [Apache-2.0](licenses/tesseract-tessdata-Apache-2.0.txt); the npm package lists MIT for the package. Policy Replay copies the model, not its wrapper. |

The core's [pinned third-party source tree](https://github.com/naptha/tesseract.js-core/tree/v7.0.0/third_party) identifies the native components. Their notices are included here: [GIFLIB](licenses/giflib-MIT.txt), [Leptonica](licenses/leptonica-BSD-2-Clause.txt), [Independent JPEG Group library](licenses/libjpeg-IJG.txt), [libpng](licenses/libpng-License.txt), [libtiff](licenses/libtiff-License.txt), [libwebp license](licenses/libwebp-BSD-3-Clause.txt) and [patent grant](licenses/libwebp-PATENTS.txt), [openlibm](licenses/openlibm-License.txt), [zlib](licenses/zlib-License.txt), and [Emscripten](licenses/emscripten-License.txt).

The shipped browser JS also uses licenses/notices for [buffer](licenses/buffer-MIT.txt), [ieee754](licenses/ieee754-BSD-3-Clause.txt), [regenerator-runtime](licenses/regenerator-runtime-License.txt), [zlib.js](licenses/zlib-js-MIT.txt), [bmp-js](licenses/bmp-js-MIT.txt), [idb-keyval](licenses/idb-keyval-Apache-2.0.txt), [is-url](licenses/is-url-MIT.txt), and [wasm-feature-detect](licenses/wasm-feature-detect-License.txt).

The bundled worker, model, and engine binaries are copied without modification from the locked npm packages. Build and test tools are installed from npm and not separately distributed in the static site.
