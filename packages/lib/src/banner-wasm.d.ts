// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

declare module 'virtual:banner-webp-wasm' {
    const module: () => WebAssembly.Module;
    export default module;
}
