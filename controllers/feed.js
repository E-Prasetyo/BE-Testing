const { validationResult } = require('express-validator');
const fileUtil = require('../utils/removeFile')

// const io = require('../socket');
const Post = require('../models/post'); 
const User = require('../models/user'); 

exports.getPosts = async(req, res, next) => {
  const page = req.query.page || 1
  const perPage = 5;

  try {
    const totalItems = await Post.find().countDocuments();
    const posts = await Post.find().populate('creator').sort({ createdAt : -1}).skip((page - 1) * perPage).limit(perPage);
    
    if (!posts) {
      const error = new Error('Data not Found.')
      error.statusCode = 422;
      throw error
    }

    res.status(200).json({
      message: 'Fetched posts successfully.',
      posts: posts,
      totalItems: totalItems
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }

};  

exports.createPost = async(req, res, next) => {
 const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed, entered data is incorrect.')
    error.statusCode = 422;
    throw error
  }
  if (!req.file) {
    const error = new Error('No image provided.');
    error.statusCode = 422;
    throw error;
  }
  const title = req.body.title;
  const content = req.body.content;
  const imageRaw = req.file.path;
  const image = imageRaw.replace("\\", "/")

  const newPost = new Post({
    title: title,
    content: content,
    imageUrl: image,
    creator: req.userId
  }); 

  try {
    await newPost.save();
    let user = await User.findById(req.userId)
    user.posts.push(newPost);
    await user.save()
    // io.getIO()
    //   .emit('posts', { action: 'create', post: { ...newPost._doc, creator: { _id: req.userId, name: user.name } } })
    res.status(201).json({
      message: 'Post created successfully!',
      post: newPost,
      creator: { _id : user._id, name: user.name}
    });
    
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

exports.getByIdPost = async(req, res, next) => {
  const postId = req.params.postId

  try {
    const post = await Post.findById(postId)
    if (!post) {
      const error = new Error('Data not Found.')
      error.statusCode = 422;
      throw error
    }
    res.status(200).json({
      message: 'Get data, successfully!',
      post: post
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500
    }
    next(error);
  }

}


exports.updatePost = async(req, res, next) => {
  const postId = req.params.postId;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error('Validation failed, entered data is incorrect.')
    error.statusCode = 422;
    throw error
  
  }
  const titleUpdate = req.body.title;
  const contentUpdate = req.body.content;
  let imageUpdate = req.body.image;

  if (req.file) {
    imageUpdate = req.file.path.replace("\\" ,"/")
  }

  try {
    let post = await Post.findById(postId).populate('creator');
    if (!post) {
      const error = new Error('Could not find post.');
      error.statusCode = 404;
      throw error;
    }
    // if (post.creator.toString() !== req.userId) { 
    if (post.creator._id.toString() !== req.userId) { 
      const error = new Error('Not authorized!');
      error.statusCode = 403;
      throw error;
    }
    if (imageUpdate !== post.imageUrl) {
      fileUtil.removeFile(post.imageUrl);
      post.imageUrl = imageUpdate;
    }
    post.title = titleUpdate;
    post.content = contentUpdate;
    const result = await post.save();
    // io.getIO()
    //   .emit('posts', {action: 'update', post: result})
    res
      .status(200)
      .json({
        message: 'Post updated!',
        post: result
      });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500
    }
    next(error);
  }
}

exports.deletePost = async(req, res, next) => {
  const postId = req.params.postId;
  try {
    let post = await Post.findById(postId);
    if (!post) {
      const error = new Error('Failed, Data not Found');
      error.statusCode = 422;
      throw error
    }
    if (post.creator.toString() !== req.userId) {
      const error = new Error('Not authorized!');
      error.statusCode = 403;
      throw error;
    }
    if (post.imageUrl) {  
      fileUtil.removeFile(post.imageUrl);
    }
    await Post.deleteOne({ _id: postId })
    let user = await User.findById(req.userId)
    user.posts.pull(postId)
    await user.save()
    // io.getIO()
    //   .emit('posts', { action: 'create', post: postId })
    
    res
      .status(200)
      .json({
        message: 'Post delete!',
        post: post  
      });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500
    }
    next(error);
  }
}