// cloudfunctions/login/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  console.log("【Login云函数】开始执行")
  
  try {
    const { OPENID } = cloud.getWXContext()
    console.log("【Login云函数】获取到OPENID:", OPENID)
    
    const userCollection = db.collection('pc_user')
    
    const existingUser = await userCollection.where({
      _openid: OPENID
    }).get()
    
    console.log("【Login云函数】查询结果:", existingUser)
    
    if (existingUser.data && existingUser.data.length > 0) {
      console.log("【Login云函数】用户已存在，返回用户数据")
      return {
        success: true,
        message: '用户已存在',
        user: existingUser.data[0]
      }
    } else {
      console.log("【Login云函数】新用户，自动注册")
      const newUser = await userCollection.add({
        data: {
          _openid: OPENID,
          nickname: "拾圆新同学",
          avatarUrl: "",
          createTime: db.serverDate()
        }
      })
      
      const createdUser = await userCollection.doc(newUser._id).get()
      console.log("【Login云函数】新用户注册成功，ID:", newUser._id)
      
      return {
        success: true,
        message: '新用户注册成功',
        user: createdUser.data
      }
    }
  } catch (err) {
    console.error("【Login云函数】执行异常:", err)
    return {
      success: false,
      message: '登录失败',
      error: err.message
    }
  }
}