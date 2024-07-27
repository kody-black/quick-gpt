// 请在使用前完成当前的配置文件

// 注意：
// 默认的API Key容量有限，可能已经耗尽无法使用
// 建议使用siliconflow免费获得API Key，申请地址：https://cloud.siliconflow.cn/
// 注册账号后在左侧账号管理选择API密钥，点击创建密钥即可获得API Key

const CONFIG = {
    // 用户名，交互时显示的名称
    USER_NAME: 'Kody',
    API_CONFIG: {
        service1: {
            // 更换为自己使用模型的 API 地址
            baseUrl: 'https://api.siliconflow.cn/v1',
            // 建议更换为自己的 API Key
            apiKey: 'sk-***********************************************',
            // 默认模型，可选，为空则默认选择获取到的第一个模型
            defaultModel: 'Qwen/Qwen2-72B-Instruct'
        },
        // 如果你使用其他服务，可以继续按照如下格式进行添加
        service2: {
            baseUrl: 'https://api.deepseek.com',
            apiKey: 'sk-***********************************************',
            defaultModel: 'deepseek-coder'
        }
    }
};

// 外部引入方式，请勿修改
module.exports = CONFIG 
