/* Copyright (c) 2016, Nordic Semiconductor ASA
 *
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *
 *   1. Redistributions of source code must retain the above copyright notice, this
 *   list of conditions and the following disclaimer.
 *
 *   2. Redistributions in binary form, except as embedded into a Nordic
 *   Semiconductor ASA integrated circuit in a product or a software update for
 *   such product, must reproduce the above copyright notice, this list of
 *   conditions and the following disclaimer in the documentation and/or other
 *   materials provided with the distribution.
 *
 *   3. Neither the name of Nordic Semiconductor ASA nor the names of its
 *   contributors may be used to endorse or promote products derived from this
 *   software without specific prior written permission.
 *
 *   4. This software, with or without modification, must only be used with a
 *   Nordic Semiconductor ASA integrated circuit.
 *
 *   5. Any software provided in binary form under this license must not be
 *   reverse engineered, decompiled, modified and/or disassembled.
 *
 *
 * THIS SOFTWARE IS PROVIDED BY NORDIC SEMICONDUCTOR ASA "AS IS" AND ANY EXPRESS OR
 * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY, NONINFRINGEMENT, AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL NORDIC SEMICONDUCTOR ASA OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE
 * GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 * HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT
 * OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

const m = require('module');
const originalLoad = m._load;

const packageConfig = require('../package.json');
const peerDeps = packageConfig.peerDependencies;

/**
 We need to ensure that the users copy of peer dependencies are used, and not this
 libraries own local copy (React component tests will fail as it doesn't like it
 when multiple copies are loaded at once). To fix this we'll do some patching of
 the Node module loader.

 https://www.sharpoblunto.com/News/2016/01/25/testing-react-component-libraries-using-npm-link
 */
if (peerDeps) {
    m._load = function (request, parent, isMain) {
        if (peerDeps[request]) {
            const parents = [];
            while (parent) {
                parents.push(parent);
                parent = parent.parent;
            }
            // reverse the usual node module resolution. Instead
            // of trying to load a local copy of the module and
            // going up until we find one, we will try to resolve
            // from the top down, this way peerDeps are preferentially
            // loaded from the parent instead.
            parent = parents.pop();
            while (parent) {
                try {
                    return originalLoad(request, parent, isMain);
                }
                catch (ex) {
                    parent = parents.pop();
                }
            }
        } else {
            return originalLoad(request, parent, isMain);
        }
    }
}
//Now export the library components
module.exports = require('../dist/nrfconnect-core.js');
m._load = originalLoad;
