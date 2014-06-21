exports.index = function(req, res){

  // views/index.jadeを呼び出す
  // 受渡変数：title
  res.render('index', { title: 'Express' });
};