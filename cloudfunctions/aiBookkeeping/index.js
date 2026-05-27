const cloud = require('wx-server-sdk');
const axios = require('axios');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { userInput, accountList = [], currentTime } = event;
  const wxContext = cloud.getWXContext();

  const DEEPSEEK_API_KEY = 'sk-088f26292b0743508f1e637098c8038f';
  const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

  const accountNamesString = accountList.length > 0 ? accountList.map(acc => acc.name).join(', ') : '微信零钱';
  const defaultAccountName = accountList.length > 0 ? accountList[0].name : '微信零钱';
  
  const totalAssets = accountList.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0).toFixed(2);

  const systemPrompt = `
你是「拾圆」智能财务管家。你不仅能精准处理记账指令，还能提供专业的财务建议。你的唯一任务是严格输出合法的 JSON 格式数据。

【当前环境与用户财务上下文】
1. 当前真实时间：${currentTime || new Date().toLocaleString()}
2. 拥有的资产账户：[${accountNamesString}]
3. 当前总净资产：${totalAssets} 元

【任务路由规则】
请分析用户的输入，判断意图并严格返回以下 JSON 结构：
1. 如果用户输入的是明确的消费/收入事件（如"花了20","赚了100"）：
{"actionType": "bookkeeping", "reply": "记账成功！", "billData": {"type": "支出/收入", "amount": 金额, "category": "分类", "note": "事件描述", "accountName": "匹配的账户名"}}

2. 如果用户是在提问、寻求分配建议或闲聊（如"我这个月该怎么分配余额"）：
{"actionType": "chat", "reply": "以贴心、专业的财务管家口吻给出的详细建议，适当换行排版", "billData": null}

注意：分类必须从 ['餐饮', '购物', '交通', '学习', '娱乐', '生活费', '兼职', '红包', '其他'] 中选择。
  `.trim();

  try {
    const response = await axios.post(DEEPSEEK_URL, {
      model: 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput }
      ],
      temperature: 0.3,
      stream: false
    }, {
      headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' }
    });

    let content = response.data.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('解析失败：未提取到 JSON 结构');
    
    const aiResult = JSON.parse(jsonMatch[0]);
    console.log('【管家引擎解析结果】:', aiResult);

    if (aiResult.actionType === 'chat') {
      return {
        success: true,
        actionType: 'chat',
        message: aiResult.reply
      };
    }

    if (aiResult.actionType === 'bookkeeping' && aiResult.billData) {
      const bill = aiResult.billData;
      const finalAmount = parseFloat(bill.amount);
      const aiAccountName = (bill.accountName || '').trim();
      
      let targetAccount = accountList.find(acc => acc.name === aiAccountName);
      if (!targetAccount && aiAccountName) {
        targetAccount = accountList.find(acc => acc.name.includes(aiAccountName) || aiAccountName.includes(acc.name));
      }

      let finalAccountId = '';
      let finalAccountName = '微信零钱';
      if (targetAccount) {
        finalAccountId = targetAccount._id;
        finalAccountName = targetAccount.name;
      } else if (aiAccountName) {
        finalAccountName = aiAccountName;
        if (accountList.length > 0) finalAccountId = accountList[0]._id;
      }

      const billData = {
        _openid: wxContext.OPENID,
        type: bill.type,
        category: bill.category,
        amount: finalAmount,
        remark: bill.note,                      
        account: finalAccountName,                   
        accountId: finalAccountId,                   
        isAA: false,
        createTime: db.serverDate(),
        creator: { nickname: "拾圆智能管家", isAI: true }
      };
      
      await db.collection('pc_bill').add({ data: billData });
      if (finalAccountId) {
        const delta = bill.type === '支出' ? -finalAmount : finalAmount;
        await db.collection('pc_account').doc(finalAccountId).update({
          data: { balance: db.command.inc(delta) }
        });
      }

      return {
        success: true,
        actionType: 'bookkeeping',
        data: bill,
        message: aiResult.reply || '记账成功'
      };
    }

  } catch (err) {
    const detailError = err.response ? err.response.data : err.message;
    console.error('【拾圆系统】AI处理异常:', detailError);
    return { success: false, error: detailError, message: '管家好像走神了，请重试' };
  }
};