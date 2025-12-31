{
    "envId": "learning-record-2gmf3u9w968a4b6e",
        "functionRoot": "cloudfunctions",
            "functions": [
                {
                    "name": "api",
                    "timeout": 5,
                    "handler": "index.main",
                    "installDependency": true,
                    "runtime": "Nodejs16.13"
                }
            ],
                "framework": {
        "name": "学习记录系统",
            "plugins": {
            "vuepress": {
                "use": "@cloudbase/framework-plugin-node",
                    "inputs": {
                    "entry": "./api/index.js",
                        "path": "/api",
                            "name": "api"
                }
            }
        }
    }
}