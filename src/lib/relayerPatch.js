
// ============================================
// POLYMARKET RELAYER PATCH (Global Injection)
// ============================================
// This file must be imported BEFORE any other libraries in main.jsx
// It overrides XMLHttpRequest and fetch to relay Polymarket requests to our backend.

(function () {
    console.log('[Relayer] Initializing Global Network Interceptor...');



    // 1. XHR Interceptor
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

    XMLHttpRequest.prototype.open = function (method, url) {
        this._url = url;
        this._method = method;
        this._headers = {};
        return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.setRequestHeader = function (header, value) {
        this._headers[header] = value;
        return originalSetRequestHeader.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
        // Intercept ALL Polymarket CLOB requests
        if (this._url && this._url.includes('clob.polymarket.com')) {
            console.log(`[Relayer] Intercepted XHR ${this._method} to ${this._url}`);

            // Extract path from full URL for the proxy
            const urlObj = new URL(this._url);
            const proxyPath = `/api/clob-proxy${urlObj.pathname}${urlObj.search}`;

            // Forward to our backend CLOB proxy
            fetch(proxyPath, {
                method: this._method,
                headers: {
                    'Content-Type': 'application/json',
                    ...this._headers
                },
                body: body || undefined
            })
                .then(async (response) => {
                    // Patch Headers Accessors
                    this.getAllResponseHeaders = function () {
                        let headerStr = '';
                        response.headers.forEach((val, key) => { headerStr += `${key}: ${val}\r\n`; });
                        return headerStr;
                    };
                    this.getResponseHeader = function (name) {
                        return response.headers.get(name);
                    };

                    const data = await response.text();

                    // console.log('[Relayer] Response Data:', data.slice(0, 100)); // Internal Debug

                    // Dispatch Success Event
                    try {
                        window.dispatchEvent(new CustomEvent('RELAYER_DEBUG', {
                            detail: {
                                type: 'XHR',
                                method: this._method,
                                url: this._url,
                                status: 'Success',
                                code: response.status,
                                body: data.slice(0, 150) // Log first 150 chars of response
                            }
                        }));

                        // Alert Removed - fixed signature issue
                    } catch (e) { }

                    Object.defineProperty(this, 'status', { value: response.status });
                    Object.defineProperty(this, 'statusText', { value: response.statusText });
                    Object.defineProperty(this, 'responseText', { value: data });

                    // Critical Fix for Axios: Respect responseType
                    let responseVal = data;
                    if (this.responseType === 'json') {
                        try {
                            responseVal = JSON.parse(data);
                        } catch (e) {
                            console.error('[Relayer] Failed to parse JSON for XHR:', e);
                        }
                    }
                    Object.defineProperty(this, 'response', { value: responseVal });

                    Object.defineProperty(this, 'readyState', { value: 4 });

                    // Trigger Standard Events (for Axios/Libraries using addEventListener)
                    this.dispatchEvent(new Event('readystatechange'));
                    this.dispatchEvent(new Event('load'));

                    // Trigger Legacy Callbacks
                    if (this.onreadystatechange) this.onreadystatechange();
                    if (this.onload) this.onload();
                })
                .catch(err => {
                    console.error('[Relayer] XHR Failure:', err);
                    // Dispatch Error Event
                    try {
                        window.dispatchEvent(new CustomEvent('RELAYER_DEBUG', {
                            detail: { type: 'XHR', method: this._method, url: this._url, status: 'Failed', error: err.message }
                        }));
                    } catch (e) { }

                    if (this.onerror) this.onerror(err);
                });

            return;
        }
        return originalSend.apply(this, arguments);
    };

    // 2. Fetch Interceptor
    const originalFetch = window.fetch;
    window.fetch = async function (input, init) {
        let url = input;
        if (input instanceof Request) {
            url = input.url;
        }

        // Convert URL object to string if needed
        if (typeof url === 'object' && url.href) url = url.href;

        if (url && typeof url === 'string' && url.includes('clob.polymarket.com')) {
            console.log(`[Relayer] Intercepted Fetch to ${url}`);

            // Dispatch Debug Event
            try {
                window.dispatchEvent(new CustomEvent('RELAYER_DEBUG', {
                    detail: { type: 'FETCH', method: (init && init.method) || 'GET', url: url, status: 'Intercepted' }
                }));
            } catch (e) { }

            const method = (init && init.method) || 'GET';
            const headers = (init && init.headers) || {};
            const body = (init && init.body);

            // Normalize headers
            let flatHeaders = {};
            if (headers instanceof Headers) {
                headers.forEach((v, k) => flatHeaders[k] = v);
            } else if (Array.isArray(headers)) {
                headers.forEach(pair => flatHeaders[pair[0]] = pair[1]);
            } else {
                flatHeaders = headers;
            }

            // Extract path from full URL for the proxy
            const urlObj = new URL(url);
            const proxyPath = `/api/clob-proxy${urlObj.pathname}${urlObj.search}`;

            // Forward to our backend CLOB proxy (preserves original method)
            return originalFetch(proxyPath, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    ...flatHeaders
                },
                body: body || undefined
            }).then(async (res) => {
                // We receive the direct CLOB proxy response
                const text = await res.text();

                // Dispatch Success Event
                try {
                    window.dispatchEvent(new CustomEvent('RELAYER_DEBUG', {
                        detail: { type: 'FETCH', method: method, url: url, status: res.ok ? 'Success' : 'Failed', code: res.status }
                    }));
                } catch (e) { }

                // Return the response with original status
                return new Response(text, {
                    status: res.status,
                    statusText: res.statusText,
                    headers: new Headers({ 'Content-Type': 'application/json' })
                });
            }).catch(err => {
                // Dispatch Error Event
                try {
                    window.dispatchEvent(new CustomEvent('RELAYER_DEBUG', {
                        detail: { type: 'FETCH', method: method, url: url, status: 'Failed', error: err.message }
                    }));
                } catch (e) { }
                throw err;
            });
        }

        return originalFetch.apply(this, arguments);
    };

    console.log('[Relayer] Global Interceptor Active');
})();
