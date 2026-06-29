const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');

const cookie = `cc-target-idc=alisg; _ga=GA1.1.758113441.1782660555; _gcl_au=1.1.697862753.1782660555; _clck=6r9cr3%5E2%5Eg7a%5E0%5E2370; passport_csrf_token=680544f5d53dcfe4722595fa8ab152f9; passport_csrf_token_default=680544f5d53dcfe4722595fa8ab152f9; sid_guard=ee433bc57971be6a1bc12c578351fcbf%7C1782660585%7C5183997%7CThu%2C+27-Aug-2026+15%3A29%3A42+GMT; uid_tt=1f4510bb0a476c262aed61654df5ad56687974176b0857325a834d349ad75905; uid_tt_ss=1f4510bb0a476c262aed61654df5ad56687974176b0857325a834d349ad75905; sid_tt=ee433bc57971be6a1bc12c578351fcbf; sessionid=ee433bc57971be6a1bc12c578351fcbf; sessionid_ss=ee433bc57971be6a1bc12c578351fcbf; tt_session_tlb_tag=sttt%7C5%7C7kM7xXlxvmobwSxXg1H8v__________38NMLmmB1BSD6gpiHjOpLPo50huFVuAArc4O8tbXtuZ4%3D; sid_ucp_v1=1.0.1-KGYxYTU4OWVhMzE5NmYzZjZkOGU4ZTdjZTNmYzZhY2JmYmJkYzMyOTAKGAiBiKLo3ZyhzWEQ6fuE0gYYnKAVOAhAEhADGgNzZzEiIGVlNDMzYmM1Nzk3MWJlNmExYmMxMmM1NzgzNTFmY2JmMk4K IGNesXd0_HrrO0wdJPTy0JAu-8i6a_4kHlqfW6hDMmH4EiBS_sglF0zcJgqoVQ5f9IG6cNhx0o-lPV8hZCOn7-KuNBgFIgZ0awt0b2s; ssid_ucp_v1=1.0.1-KGYxYTU4OWVhMzE5NmYzZjZkOGU4ZTdjZTNmYzZhY2JmYmJkYzMyOTAKGAiBiKLo3ZyhzWEQ6fuE0gYYnKAVOAhAEhADGgNzZzEiIGVlNDMzYmM1Nzk3MWJlNmExYmMxMmM1NzgzNTFmY2JmMk4K IGNesXd0_HrrO0wdJPTy0JAu-8i6a_4kHlqfW6hDMmH4EiBS_sglF0zcJgqoVQ5f9IG6cNhx0o-lPV8hZCOn7-KuNBgFIgZ0awt0b2s; store-idc=alisg; store-country-code=vn; store-country-code-src=uid; tt-target-idc-sign=f8f5UiLL6bUPkIa32X7SAfIR1Qi1PPugbo2OE43l2GmSmdUb6z6UF9URCPeNDnedeq_Z9JAsHifWPUop6xCWfushtuz8bQHyvIbelBMFuInCqIZFZD85JmbNUDetGL3kLqUtIhtNiyWuhN0Kq7BZntbiHIANh_eU7g1d5Gupj4ZMGU5AElkz2mRGKYtm-RSjIBCRbTL8skX5rwxkKwF4H-1Hxno1z41QdtM130jdh3FoDdjMTLfozt6cvCzYE4-6h0oJMNcabZUIdjfTWuqGH46l3CcGY-X9lllAa1WjIe52xx4N0r8ha7XaeV0buqzLfvmHTYxcEgR8CRB8OZSYXcQS1YUDNUKWpKPcsK7RrVS73Y5qjAbSF-5iYgyiWb4KcwBbOELXn6JYLo8DMzvO6OuD8Y-VBDPnKnBkfhuo4hfyMfOsjWThnAouct61QvihsJ-gEg2xYKZL23AHjMhA3vmjLrC5qrip8MQsGYEEFUiS3Bpu4dHfZe4ci9i-wtfQ; ttwid=1|dSLmVau6HRclrs_xwlkbJbMhF8PfKFZgnEzI_fWhB4g|1782661129|df186e20ad3163aeeb628818fcf4319a833b914c0456951d1f4404cb602979f1; uifid=880181825689a65dfe6540b38551a1e0e995268b4ab4878fcaae61561e88e935868b130dd81adfc707e1a7077262332f42f9e2b84119c78200b833ea7338648bea1519f7194acda2fc6a363e822895d33a537dfeeea0f79858925edbed988b7368593dadf1c5fc4495201de17508d0219af774d6fbca7ddd074266b96ab58e6c080a1390e9b253da5b1555231db714cc5cb154697762c9d9a4a9b475ea3569c1a6d3ca64a6fc403a07c22715240e8e14; _ga_8CN68HEXH2=GS2.1.s1782660554$o1$g1$t1782661133$j59$l0$h0; _ga_F9J0QP63RB=GS2.1.s1782660554$o1$g1$t1782661133$j59$l0$h0; _uetsid=1f4a3150730611f1bb3507d73c58e71a; _uetvid=1f4abd50730611f1825c23d3f81a39ee; odin_tt=b099ac73b5d0c077a2f550581deed70ae374b0b62474af56639e1afbeee3ce9f09c3ef08acbb2cf543a8f7fbe6337fdb44b392462fe3372fb452adc3b33fb6b5; _clsk=1i7oywh%5E1782661142970%5E2%5E0%5Ef.clarity.ms%2Fcollect; msToken=zWzpZk5OZH4e-ycHZCnBTlCq1ZNWbnPc4gMaSrUInnobh9p8xBHkwOXxtQXbaZYdVs5neInDfY6kq2CG5frVcjlyZse_1ZE9nyGNNV3z1yXb8aoLMXNf__ueceA=; store-country-sign=MEIEDCg8Q6gSQ4b3BQQw4QQgmqrounI-nopq1ju-pkzWAveP2YuBM9LYfwG9aJBzLP0EEBO4iSeiixhpkF1AUMy6YcQ`;

async function test(text, filename) {
  try {
    const payload = JSON.stringify({
      text: text,
      speaker: "BV421_vivn_streaming",
      audio_config: { speech_rate: 0, pitch_rate: 0 },
      platform: 1,
      is_sync: true,
      lan: "vi",
      item_id: "7252594014782755330",
      speaker_source: 1
    });

    const payloadBuffer = Buffer.from(payload, 'utf8');
    const deviceTime = Math.floor(Date.now() / 1000);
    const path = '/lv/v2/intelligence/tts/get_audition';
    const pf = '7';
    const appvr = '8.4.0';
    const tdid = '';

    const signStr = `9e2c|udition|${pf}|${appvr}|${deviceTime}|${tdid}|11ac`;
    const sign = crypto.createHash('md5').update(signStr).digest('hex');

    const headers = {
      'Cookie': cookie,
      'Content-Type': 'application/json',
      'Content-Length': payloadBuffer.length,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) CAPCUT_PC/8.8.0 Chrome/121.0.6167.86 Safari/537.36',
      'Origin': 'https://www.capcut.com',
      'Referer': 'https://www.capcut.com/',
      'did': '7655937363961415189',
      'sign-ver': '1',
      'sign': sign,
      'pf': pf,
      'store-country-code': 'vn',
      'store-country-code-src': 'uid',
      'appvr': appvr,
      'appid': '348188',
      'device-time': String(deviceTime)
    };

    const response = await axios.post('https://edit-api-sg.capcut.com/lv/v2/intelligence/tts/get_audition', payloadBuffer, { headers });
    if (response.data.data && response.data.data.url) {
      const audioUrl = response.data.data.url;
      const downloadRes = await axios({
        method: 'get',
        url: audioUrl,
        responseType: 'arraybuffer'
      });
      fs.writeFileSync(filename, downloadRes.data);
      console.log(`Saved ${filename}, size = ${downloadRes.data.length}`);
    }
  } catch (error) {
    console.error(error.message);
  }
}

async function run() {
  await test("Chào", "chao.mp3");
  await test("Chào bạn. Vui lòng nhập văn bản của bạn vào đây và chọn một giọng nói để dùng thử. Bạn cũng có thể tải lên một video hoặc tệp âm thanh. Chúng tôi hỗ trợ nhiều ngôn ngữ.", "default.mp3");
}

run();
