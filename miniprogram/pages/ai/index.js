Page({
  data: {
    voiceInputText: '',
    isTyping: false,
    chatMessages: [],
    scrollTop: 0,
    scrollToId: '',
    messageId: 0,
    accountList: []
  },

  onLoad() {
    this.setData({ messageId: 0 });
    this.fetchAccountList();
  },

  onShow() {
    this.fetchAccountList();
  },

  async fetchAccountList() {
    const app = getApp();
    if (!app.globalData.userInfo) return;

    try {
      const db = wx.cloud.database();
      const res = await db.collection('pc_account').where({
        _openid: '{openid}'
      }).get();

      if (res.data.length > 0) {
        this.setData({ accountList: res.data });
      } else {
        const defaultAccounts = [
          { _id: 'temp1', name: '微信零钱', balance: 0, icon: '💬' },
          { _id: 'temp2', name: '支付宝', balance: 0, icon: '💰' },
          { _id: 'temp3', name: '银行卡', balance: 0, icon: '🏦' }
        ];
        this.setData({ accountList: defaultAccounts });
      }
    } catch (err) {
      console.error('获取账户列表失败:', err);
    }
  },

  onInputChange(e) {
    this.setData({
      voiceInputText: e.detail.value
    });
  },

  async handleSend() {
    const text = this.data.voiceInputText.trim();
    if (!text) {
      wx.showToast({ title: '请输入记账内容', icon: 'none' });
      return;
    }

    const userMsg = {
      id: ++this.data.messageId,
      role: 'user',
      type: 'text',
      content: text
    };

    const messages = [...this.data.chatMessages, userMsg];
    this.setData({
      chatMessages: messages, 
      voiceInputText: '', 
      isTyping: true
    });

    this.scrollToBottom();

    try {
      if (this.data.accountList.length === 0) {
        await this.fetchAccountList();
      }

      console.log('【AI记账】发送请求，userInput:', text);
      
      const res = await wx.cloud.callFunction({
        name: 'aiBookkeeping',
        data: {
          userInput: text,
          accountList: this.data.accountList,
          currentTime: new Date().toLocaleString('zh-CN', { 
            year: 'numeric', month: '2-digit', day: '2-digit', 
            hour: '2-digit', minute: '2-digit', second: '2-digit' 
          })
        }
      });

      this.setData({ isTyping: false });

      if (res.result && res.result.success) {
        const actionType = res.result.actionType;
        
        if (actionType === 'chat') {
          const chatMsg = {
            id: ++this.data.messageId,
            role: 'ai',
            type: 'text',
            content: res.result.message || '好的，我明白了！'
          };
          this.setData({
            chatMessages: [...this.data.chatMessages, chatMsg]
          }, () => {
            this.scrollToBottom();
          });
        } else if (actionType === 'bookkeeping') {
          wx.vibrateShort({ type: 'light' });
          
          const aiResult = res.result.data;
          const confirmMsg = {
            id: ++this.data.messageId,
            role: 'ai',
            type: 'text',
            content: res.result.message || '记好啦！注意不要超支哦！💪'
          };

          const cardMsg = {
            id: ++this.data.messageId,
            role: 'ai',
            type: 'card',
            content: {
              amount: aiResult.amount.toFixed ? aiResult.amount.toFixed(2) : String(aiResult.amount),
              category: aiResult.category,
              account: aiResult.accountName,
              time: this.getCurrentTime(),
              type: aiResult.type,
              remark: aiResult.note
            }
          };

          this.setData({
            chatMessages: [...this.data.chatMessages, confirmMsg, cardMsg]
          }, () => {
            this.scrollToBottom();
          });
        }
      } else {
        const errorMsg = {
          id: ++this.data.messageId,
          role: 'ai',
          type: 'text',
          content: res.result?.message || '抱歉，管家好像走神了'
        };
        this.setData({
          chatMessages: [...this.data.chatMessages, errorMsg]
        }, () => {
          this.scrollToBottom();
        });
      }
    } catch (err) {
      this.setData({ isTyping: false });
      console.error('调用云函数失败:', err);
      const errorMsg = {
        id: ++this.data.messageId,
        role: 'ai',
        type: 'text',
        content: '哎呀，网络有点慢，请再试一下'
      };
      this.setData({
        chatMessages: [...this.data.chatMessages, errorMsg]
      }, () => {
        this.scrollToBottom();
      });
    }
  },

  scrollToBottom() {
    this.setData({
      scrollToId: 'bottom-anchor'
    });
    setTimeout(() => {
      this.setData({ scrollToId: '' });
    }, 300);
  },

  getCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
});
