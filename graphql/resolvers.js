const Bcrypt = require('bcrypt');
const validator = require('validator')
const User = require('../models/user')
const Post = require('../models/post')
const jwt = require('jsonwebtoken')
const file = require('../utils/removeFile')

module.exports = {
    createUser: async function ({ userInput }, req) {
        const errors = [];
        if (!validator.isEmail(userInput.email)) {
            errors.push({message: 'E-mail is invalid'})
        }
        if (
            validator.isEmpty(userInput.password) ||
            !validator.isLength(userInput.password, { min: 5 })
        ) {
            errors.push({ message: 'Password too short!' });
        }
        if (errors.length > 0) {
            const error = new Error('Invalid input.');
            error.data = errors;
            error.code = 422;
            throw error;
        }
        const existingUser = await User.findOne({ email: userInput.email });
        if (existingUser) {
            const error = new Error('Email is already used by user ')
            throw error
        }
        const hashPassword = await Bcrypt.hash(userInput.password, 12);
        const newUser = new User({
            name: userInput.name,
            email: userInput.email,
            password: hashPassword
        })
        const saveUser = await newUser.save();
        return { ...saveUser._doc, _id : saveUser._id.toString() }
    },
    login: async function ({ userInput }, req) {
        // const errors = [];
        const existingUser = await User.findOne({ email: userInput.email });
        if (!existingUser) {
            const error = new Error('Email is not register');
            error.code = 401;
            throw error
        }
        const isEqual = await Bcrypt.compare(userInput.password, existingUser.password);
        if (!isEqual) {
            const error = new Error('Wrong password!');
            error.statusCode = 401;
            throw error;
        }

        const token = jwt.sign(
            {
                email: existingUser.email,
                userId: existingUser._id.toString()
            },
            process.env.APP_SECRETE_TOKEN,
            { expiresIn: '1h' }
        );
        return {
            token: token,
            userId: existingUser._id.toString()
        }
    },
    createPost: async function ({ postInput }, req) {
        if (!req.isAuth) {
            const error = new Error('Not authenticated!');
            error.code = 401;
            throw error;
        }
        const errors = []
        if (
            validator.isEmpty(postInput.title) ||
            !validator.isLength(postInput.title, { min: 5 })
        ) {
            errors.push({ message: 'Title is invalid.' });
        }
        if (
            validator.isEmpty(postInput.content) ||
            !validator.isLength(postInput.content, { min: 5 })
        ) {
            errors.push({ message: 'Content is invalid.' });
        }
        if (errors.length > 0) {
            const error = new Error('Invalid input.');
            error.data = errors;
            error.code = 422;
            throw error;
        }
        const user = await User.findById(req.userId);
        if (!user) {
            const error = new Error('Invalid user.');
            error.code = 401;
            throw error;
        }
        const post = new Post({
            title: postInput.title,
            content: postInput.content,
            imageUrl: postInput.imageUrl,
            creator: user
        });
        const createdPost = await post.save();
        user.posts.push(createdPost);
        await user.save();
        return {
            ...createdPost._doc,
            _id: createdPost._id.toString(),
            createdAt: createdPost.createdAt.toISOString(),
            updatedAt: createdPost.updatedAt.toISOString()
        };
    },
    postsData: async function ({ page, limit }, req) {
        if (!page){ page=1 }
        if (!limit){ limit=3 }
        if (!req.isAuth) {
            const error = new Error('Not authenticated!');
            error.code = 401;
            throw error;
        }
        const postsRaw = await Post.find().sort({ createdAt: -1 }).populate('creator').skip((page - 1) * limit).limit(limit);;
        const totalPosts = await Post.find().countDocuments();
        const posts = postsRaw.map(value => { 
            return {
                ...value._doc, 
                _id: value._id.toString(),
                createdAt: value.createdAt.toString(),
                updatedAt: value.updatedAt.toString()
            }
        })
        return {
            posts: posts,
            totalPosts: totalPosts
        }
    },
    post: async function ({ postId }, req) {
        if (!req.isAuth) {
            const error = new Error('Not authenticated!');
            error.code = 401;
            throw error;
        }
        const postData = await Post.findById(postId).populate('creator')
        if (!postData) {
            const error = new Error('Post is not exist');
            error.code = 401;
            throw error
        }
        return {
            ...postData._doc,
            _id: postData._id.toString(),
            createdAt: postData.createdAt.toString(),
            updatedAt: postData.updatedAt.toString()
        }
    },
    updatePost: async function ({ postId, postInput }, req) {

        if (!req.isAuth) {
            const error = new Error('Not authenticated!');
            error.code = 401;
            throw error;
        }

        const post = await Post.findById(postId).populate('creator');
        if (!post) {
            const error = new Error('No post found!');
            error.code = 404;
            throw error;
        }
        if (post.creator._id.toString() !== req.userId.toString()) {
            const error = new Error('Not authorized!');
            error.code = 403;
            throw error;
        }
        
        const errors = [];
        if (
            validator.isEmpty(postInput.title) ||
            !validator.isLength(postInput.title, { min: 5 })
        ) {
            errors.push({ message: 'Title is invalid.' });
        }
        if (
            validator.isEmpty(postInput.content) ||
            !validator.isLength(postInput.content, { min: 5 })
        ) {
            errors.push({ message: 'Content is invalid.' });
        }
        if (errors.length > 0) {
            const error = new Error('Invalid input.');
            error.data = errors;
            error.code = 422;
            throw error;
        }

        const existingPost = await Post.findById(postId).populate('creator');
        if (!existingPost) {
            const error = new Error('Post is not exist');
            error.code = 401;
            throw error
        }
        existingPost.title = postInput.title;
        existingPost.content = postInput.content;
        if (postInput.imageUrl !== 'undefined') {
            existingPost.imageUrl = postInput.imageUrl;
        }
        
        const updatedPost = await existingPost.save();
        return {
            ...updatedPost._doc,
            _id: updatedPost._id.toString(),
            createdAt: updatedPost.createdAt.toISOString(),
            updatedAt: updatedPost.updatedAt.toISOString()
        };
    },
    deletePost: async function({postId}, req) {
        if (!req.isAuth) {
            const error = new Error('Not authenticated!');
            error.code = 401;
            throw error;
        }
        const post = await Post.findById(postId);
        if (!post) {
            const error = new Error('No post found!');
            error.code = 404;
            throw error;
        }
        if (post.creator.toString() !== req.userId.toString()) {
            const error = new Error('Not authorized!');
            error.code = 403;
            throw error;
        }
        file.removeFile(post.imageUrl);
        await Post.findByIdAndRemove(postId);
        const user = await User.findById(req.userId);
        user.posts.pull(postId);
        await user.save();
        return true;
    },
    user: async function (args, req) {
        if (!req.isAuth) {
            const error = new Error('Not authenticated!');
            error.code = 401;
            throw error;
        }
        const user = await User.findById(req.userId);
        if (!user) {
            const error = new Error('No post found!');
            error.code = 404;
            throw error;
        }
        return {
            ...user._doc,
            _id: user._id.toString()
        }
    },
    updateStatus: async function ({ status }, req) {
        let errors =[]
         if (!req.isAuth) {
            const error = new Error('Not authenticated!');
            error.code = 401;
            throw error;
        }
        if (validator.isEmpty(status)) {
            errors.push({ message: 'Status not empty!' });
        }
        if (errors.length > 0) {
            const error = new Error('Invalid input.');
            error.data = errors;
            error.code = 422;
            throw error;
        }
        const user = await User.findById(req.userId);
        if (!user) {
            const error = new Error('No post found!');
            error.code = 404;
            throw error;
        }
        user.status = status;
        await user.save();
        return {
            ...user._doc,
            _id: user._id.toString()
        }
    }
}