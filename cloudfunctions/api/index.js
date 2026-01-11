const express = require('express');
const serverless = require('serverless-express');
const tcb = require('@cloudbase/node-sdk');

const app = express();
app.use(express.json());

// 初始化云开发环境
const tcbApp = tcb.init({ env: tcb.SYMBOL_CURRENT_ENV });
const db = tcbApp.database();

// 1. 同步接口：保存数据
app.post('/api/sync', async (req, res) => {
    try {
        const { uid, history, wrongBook, honorWall } = req.body;
        if (!uid) return res.status(400).json({ success: false, message: "缺少用户ID" });

        await db.collection('user_data').doc(uid).set({
            history,
            wrongBook,
            honorWall,
            updateTime: new Date()
        });

        res.json({ success: true, message: '同步成功' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. 拉取接口：获取数据
app.get('/api/data/:uid', async (req, res) => {
    try {
        const { uid } = req.params;
        const result = await db.collection('user_data').doc(uid).get();
        if (result.data && result.data.length > 0) {
            res.json({ success: true, data: result.data[0] });
        } else {
            res.json({ success: true, data: null });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

const handler = serverless(app);

exports.main = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

    try {
        const result = await handler(event, context);
        result.headers = Object.assign(result.headers || {}, headers);
        return result;
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};