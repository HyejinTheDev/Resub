const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');

const cookie = `cc-target-idc=alisg; _ga=GA1.1.758113441.1782660555; _gcl_au=1.1.697862753.1782660555; _clck=6r9cr3%5E2%5Eg7a%5E0%5E2370; passport_csrf_token=680544f5d53dcfe4722595fa8ab152f9; passport_csrf_token_default=680544f5d53dcfe4722595fa8ab152f9; sid_guard=ee433bc57971be6a1bc12c578351fcbf%7C1782660585%7C5183997%7CThu%2C+27-Aug-2026+15%3A29%3A42+GMT; uid_tt=1f4510bb0a476c262aed61654df5ad56687974176b0857325a834d349ad75905; uid_tt_ss=1f4510bb0a476c262aed61654df5ad56687974176b0857325a834d349ad75905; sid_tt=ee433bc57971be6a1bc12c578351fcbf; sessionid=ee433bc57971be6a1bc12c578351fcbf; sessionid_ss=ee433bc57971be6a1bc12c578351fcbf; tt_session_tlb_tag=sttt%7C5%7C7kM7xXlxvmobwSxXg1H8v__________38NMLmmB1BSD6gpiHjOpLPo50huFVuAArc4O8tbXtuZ4%3D; sid_ucp_v1=1.0.1-KGYxYTU4OWVhMzE5NmYzZjZkOGU4ZTdjZTNmYzZhY2JmYmJkYzMyOTAKGAiBiKLo3ZyhzWEQ6fuE0gYYnKAVOAhAEhADGgNzZzEiIGVlNDMzYmM1Nzk3MWJlNmExYmMxMmM1NzgzNTFmY2JmMk4K IGNesXd0_HrrO0wdJPTy0JAu-8i6a_4kHlqfW6hDMmH4EiBS_sglF0zcJgqoVQ5f9IG6cNhx0o-lPV8hZCOn7-KuNBgFIgZ0aWt0b2s; ssid_ucp_v1=1.0.1-KGYxYTU4OWVhMzE5NmYzZjZkOGU4ZTdjZTNmYzZhY2JmYmJkYzMyOTAKGAiBiKLo3ZyhzWEQ6fuE0gYYnKAVOAhAEhADGgNzZzEiIGVlNDMzYmM1Nzk3MWJlNmExYmMxMmM1NzgzNTFmY2JmMk4K IGNesXd0_HrrO0wdJPTy0JAu-8i6a_4kHlqfW6hDMmH4EiBS_sglF0zcJgqoVQ5f9IG6cNhx0o-lPV8hZCOn7-KuNBgFIgZ0aWt0b2s; store-idc=alisg; store-country-code=vn; store-country-code-src=uid; tt-target-idc-sign=f8f5UiLL6bUPkIa32X7SAfIR1Qi1PPugbo2OE43l2GmSmdUb6z6UF9URCPeNDnedeq_Z9JAsHifWPUop6xCWfushtuz8bQHyvIbelBMFuInCqIZFZD85JmbNUDetGL3kLqUtIhtNiyWuhN0Kq7BZntbiHIANh_eU7g1d5Gupj4ZMGU5AElkz2mRGKYtm-RSjIBCRbTL8skX5rwxkKwF4H-1Hxno1z41QdtM130jdh3FoDdjMTLfozt6cvCzYE4-6h0oJMNcabZUIdjfTWuqGH46l3CcGY-X9lllAa1WjIe52xx4N0r8ha7XaeV0buqzLfvmHTYxcEgR8CRB8OZSYXcQS1YUDNUKWpKPcsK7RrVS73Y5qjAbSF-5iYgyiWb4KcwBbOELXn6JYLo8DMzvO6OuD8Y-VBDPnKnBkfhuo4hfyMfOsjWThnAouct61QvihsJ-gEg2xYKZL23AHjMhA3vmjLrC5qrip8MQsGYEEFUiS3Bpu4dHfZe4ci9i-wtfQ; ttwid=1|dSLmVau6HRclrs_xwlkbJbMhF8PfKFZgnEzI_fWhB4g|1782661129|df186e20ad3163aeeb628818fcf4319a833b914c0456951d1f4404cb602979f1; uifid=880181825689a65dfe6540b38551a1e0e995268b4ab4878fcaae61561e88e935868b130dd81adfc707e1a7077262332f42f9e2b84119c78200b833ea7338648bea1519f7194acda2fc6a363e822895d33a537dfeeea0f79858925edbed988b7368593dadf1c5fc4495201de17508d0219af774d6fbca7ddd074266b96ab58e6c080a1390e9b253da5b1555231db714cc5cb154697762c9d9a4a9b475ea3569c1a6d3ca64a6fc403a07c22715240e8e14; _ga_8CN68HEXH2=GS2.1.s1782660554$o1$g1$t1782661133$j59$l0$h0; _ga_F9J0QP63RB=GS2.1.s1782660554$o1$g1$t1782661133$j59$l0$h0; _uetsid=1f4a3150730611f1bb3507d73c58e71a; _uetvid=1f4abd50730611f1825c23d3f81a39ee; odin_tt=b099ac73b5d0c077a2f550581deed70ae374b0b62474af56639e1afbeee3ce9f09c3ef08acbb2cf543a8f7fbe6337fdb44b392462fe3372fb452adc3b33fb6b5; _clsk=1i7oywh%5E1782661142970%5E2%5E0%5Ef.clarity.ms%2Fcollect; msToken=zWzpZk5OZH4e-ycHZCnBTlCq1ZNWbnPc4gMaSrUInnobh9p8xBHkwOXxtQXbaZYdVs5neInDfY6kq2CG5frVcjlyZse_1ZE9nyGNNV3z1yXb8aoLMXNf__ueceA=; store-country-sign=MEIEDCg8Q6gSQ4b3BQQw4QQgmqrounI-nopq1ju-pkzWAveP2YuBM9LYfwG9aJBzLP0EEBO4iSeiixhpkF1AUMy6YcQ`;

const publicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmTd34Lw4b7IuldSXh/zY
CMla+ITdGG5TeWz6ad+OySd4r+IrY45AoqrYUxhQ2dl+7z+i7r/5vEa8rr39BYfB
8AGMQLmZA8HmgpWBsqrn/V6daUALkKnkLb70Fn32CJigIuGXAYqxUdGuI340aC+0
v5Es3puJsHyzf01/AelE4Cdc6bZhQrASJLBh8R3BQToYClmDVSDUQk28o8sl/guA
Z4n303Vj+6Siv1HayPCdV6kpVVnMBAG4+umUbwGmn132N3fgpzLarFF3XyWmS1zh
D/J07iM/rP8GDO9IskHNHd2phrO0G6KzrcFAnTBHjVv+hCBEfzN/no3FNA9AuC36
mwIDAQAB
-----END PUBLIC KEY-----`;

function rsaEncrypt(message) {
  const buffer = Buffer.from(message, 'utf8');
  const encrypted = crypto.publicEncrypt({
    key: publicKey,
    padding: crypto.constants.RSA_PKCS1_PADDING
  }, buffer);
  return encrypted.toString('base64');
}

function makeTraceId() {
  const seed = crypto.randomBytes(16).toString('hex');
  return `00-${seed}-${seed.substring(0, 16)}-01`;
}

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function test() {
  try {
    const text = "Vừa nãy anh có thấy một bệnh nhân chạy qua đây không?";
    const voice = "BV421_vivn_streaming";
    const resource_id = "7252594014782755330";
    const rate = "1.0";

    const device = {
      aid: "359289",
      app_name: "CapCut",
      appvr: "8.7.0",
      channel: "capcutpc_google",
      device_platform: "mac",
      device_type: "MacBookPro17,1",
      device_brand: "MacBookPro17,1",
      os_version: "15.7.4",
      device_id: "7647183892936328721",
      iid: "7647185302080423697",
      region: "VN",
      loc: "VN",
      lan: "vi-VN",
      pf: "3",
      tdid: "7647183892936328721",
    };

    const babi = {
      feature_entrance: "editor",
      feature_entrance_detail: "editor-feature-text_to_speech",
      feature_key: "text_to_speech",
      scenario: "video_editor",
    };

    const voice_blocks = [
      `    <voice name="${voice}" mock_tone_info="" platform="sami" ` +
      `resource_id="${resource_id}" emotion="" emotion_scale="0" style="" role="" ` +
      `moyin_emotion="" is_clone_tone="false" need_subtitle_timestamp="false">\n` +
      `        <prosody rate="${rate}">${escapeXml(text)}</prosody>\n` +
      `    </voice>`
    ];

    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">\n` +
      voice_blocks.join('\n') +
      `\n</speak>`;

    const extra_info = JSON.stringify({ benefit_info: {} });
    
    // Create inner signature
    const ssml_md5 = crypto.createHash('md5').update(ssml).digest('hex');
    const sign_input = `appid:${device.aid}&did:${device.device_id}&creditDisable:false&ssml:${ssml_md5}&extraInfo:${extra_info}`;
    const payloadSign = rsaEncrypt(sign_input);

    const payload = {
      audio_format: "mp3",
      babi_param: JSON.stringify(babi),
      credit_disable: false,
      extra_info: extra_info,
      need_merge_voice: false,
      need_subtitle_timestamp: false,
      scene: "text_to_speech",
      ssml: ssml,
      sign: payloadSign
    };

    const body = {
      bind_id: crypto.randomUUID(),
      can_queue: true,
      enter_from: "text_to_speech",
      tasks: [
        {
          context: crypto.randomUUID(),
          payload: JSON.stringify(payload),
          req_key: "sami_text_to_speech",
          task_version: "v3",
        }
      ]
    };

    const bodyText = JSON.stringify(body);
    const bodyMd5 = crypto.createHash('md5').update(bodyText).digest('hex');

    const queryParams = {
      app_name: device.app_name,
      device_type: device.device_type,
      os_version: device.os_version,
      channel: device.channel,
      version_name: device.appvr,
      device_brand: device.device_brand,
      device_id: device.device_id,
      iid: device.iid,
      version_code: device.appvr,
      device_platform: device.device_platform,
      aid: device.aid,
      region: device.region,
      babi_param: JSON.stringify(babi)
    };

    const url = `https://editor-api-sg.capcutapi.com/lv/v1/common_task/new?${new URLSearchParams(queryParams).toString()}`;
    const now = Math.floor(Date.now() / 1000);

    // Signature header: 9e2c|{path[-7:]}|3|{appvr}|{device_time}|{tdid}|11ac
    // path is /lv/v1/common_task/new, path[-7:] is "ask/new"
    const pathPart = "ask/new";
    const signStr = `9e2c|${pathPart}|3|${device.appvr}|${now}|${device.tdid}|11ac`;
    const sign = crypto.createHash('md5').update(signStr).digest('hex');

    const headers = {
      'Cookie': cookie,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyText, 'utf8'),
      'appvr': device.appvr,
      'ch': device.channel,
      'device-time': String(now),
      'lan': device.lan,
      'loc': device.loc,
      'pf': device.pf,
      'sign-ver': '1',
      'tdid': device.tdid,
      'x-ss-stub': bodyMd5,
      'x-ss-dp': device.aid,
      'x-khronos': String(now),
      'x-tt-trace-id': makeTraceId(),
      'user-agent': 'Cronet/TTNetVersion:1d7cc3b1 2025-07-16 QuicVersion:52c2b40d 2025-04-03',
      'store-country-code': device.loc.toLowerCase(),
      'store-country-code-src': 'did',
      'is-dispatch-us-ttp': '0',
      'is-app-region-us-ttp': '0',
      'app-sdk-version': device.appvr,
      'appid': device.aid,
      'sign': sign
    };

    console.log('Sending request to editor-api-sg.capcutapi.com...');
    const response = await axios.post(url, bodyText, { headers });
    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    if (error.response) {
      console.error('Error Status:', error.response.status);
      console.error('Error Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
}

test();
