// import Bottleneck from 'bottleneck';

// const limiter = new Bottleneck({
//     maxConcurrent: 1,
//     minTime: 105, // space out the calls and slightly more to not hit against the window
// });

// async function post(url, body, opts = {}) {
//     return limiter.schedule(() =>
//         fetch(url, { ...opts, body: JSON.stringify(body) })
//     );
// }

// export class ApiClient {
//     constructor({ baseUrl, apiKey }) {
//         this.baseUrl = baseUrl;
//         this.apiKey = apiKey;
//     }

//     async sendBalances(balances) {
//         const payload = balances.map(b => ({
//             ...b,
//             balance: b.balance.toString(),
//         }));
//         return post(`${this.baseUrl}/api/log`, payload, {
//             headers: {
//                 'Content-Type': 'application/json',
//                 'x-api-key': this.apiKey
//             }
//         });
//     }
// }