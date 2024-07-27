const fs = require('fs');
const path = require('path');

const CONFIG_TEMPLATE_PATH = path.join(__dirname, 'config.template.json');
// 将配置文件放在用户数据目录下
userDataPath = utools.getPath('userData');
const CONFIG_PATH = path.join(userDataPath, 'quickgpt_config.json');

// 检查如果没有配置文件则创建一个
if (!fs.existsSync(CONFIG_PATH)) {
    console.log('Creating config.json from template...');
    fs.copyFileSync(CONFIG_TEMPLATE_PATH, CONFIG_PATH);
    // 打开配置文件
    window.openSetting();
}

utools.onPluginEnter(({ code }) => {
    if (code === 'gptconfig') {
        window.openSetting();
    }
    else if (global.CONFIG === undefined) {
        window.loadConfig();
    }
});

// 加载配置文件
window.loadConfig = function () {
    global.CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    global.API_CONFIG = CONFIG.API_CONFIG;
    global.USER_NAME = CONFIG.USER_NAME;
}

// 保存配置文件
window.saveConfig = function (config) {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 4));
        utools.showNotification('配置文件已保存');
        return true;
    } catch (error) {
        utools.showNotification('配置文件保存失败');
        return false;
    }
}

// 打开设置界面
window.openSetting = function () {
    const ubWindow = utools.createBrowserWindow('setting.html', {
        title: 'QuickGPT 配置',
        webPreferences: {
            preload: 'preload.js'
        }
    }, () => {
        ubWindow.setFullScreen(true)
        console.log('Setting window opened');
    });

}
