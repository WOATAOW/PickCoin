Component({
  data: {
    selected: 0,
    list: [
      {
        pagePath: "/pages/index/index",
        text: "首页",
        iconPath: "/static/tabs/home.png",
        selectedIconPath: "/static/tabs/home-active.png"
      },
      {
        pagePath: "/pages/history/index",
        text: "明细",
        iconPath: "/static/tabs/history.png",
        selectedIconPath: "/static/tabs/history-active.png"
      },
      {
        pagePath: "/pages/ai/index",
        text: "AI管家",
        iconPath: "/static/tabs/ai.png",
        selectedIconPath: "/static/tabs/ai-active.png",
        isCenter: true
      },
      {
        pagePath: "/pages/book/index",
        text: "记账",
        iconPath: "/static/tabs/book.png",
        selectedIconPath: "/static/tabs/book-active.png"
      },
      {
        pagePath: "/pages/profile/index",
        text: "我的",
        iconPath: "/static/tabs/profile.png",
        selectedIconPath: "/static/tabs/profile-active.png"
      }
    ]
  },

  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = data.path;
      wx.switchTab({ url });
    }
  }
});
