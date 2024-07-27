const fs = require('fs');
const path = require('path');

const CONFIG_TEMPLATE_PATH = path.join(__dirname, 'config.template.js');
// 将配置文件放在用户数据目录下
userDataPath = utools.getPath('userData');
const CONFIG_PATH = path.join(userDataPath, 'quickgpt_config.js');

// 检查如果没有配置文件则创建一个
if (!fs.existsSync(CONFIG_PATH)) {
    console.log('Creating config.json from template...');
    fs.copyFileSync(CONFIG_TEMPLATE_PATH, CONFIG_PATH);
    // 打开配置文件
    utools.showNotification('请使用文本编辑器打开配置文件，修改完成保存后点击重置');
    utools.shellOpenPath(CONFIG_PATH);
}

utools.onPluginEnter(({ code }) => {
    if (code === 'gptconfig') {
        utools.shellOpenPath(CONFIG_PATH);
        utools.outPlugin();
    }
    else if (global.CONFIG === undefined) {
        global.CONFIG = require(CONFIG_PATH);
        global.API_CONFIG = CONFIG.API_CONFIG;
        global.USER_NAME = CONFIG.USER_NAME;
    }
});

// 加载配置文件
window.loadConfig = function () {
    // 清除模块缓存
    delete require.cache[require.resolve(CONFIG_PATH)];
    global.CONFIG = require(CONFIG_PATH);
    global.API_CONFIG = CONFIG.API_CONFIG;
    global.USER_NAME = CONFIG.USER_NAME;
}
