import mongoose from "mongoose";
import { Message } from "../models/Message.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/User.model.js";
import { BlockedUser } from "../models/BlockUser.model.js";
import { Friend } from "../models/Friend.model.js";

//**** CREATE MESSAGE ***** */
const createMessage = asyncHandler(async (req, res) => {
    const { sender, recipient, message } = req.body;
    const userId = req.user._id;

    if (!sender || !recipient || !message) {
        throw new ApiError(400, "All fields are required");
    }

    // Fetching sender and recipient IDs
    const senderUser = await User.findOne({ userName: sender });
    const recipientUser = await User.findOne({ userName: recipient });

    if (!senderUser || !recipientUser) {
        throw new ApiError(404, "Sender or recipient not found");
    }

    // Checking if the sender is the logged-in user
    if (senderUser._id.toString() !== userId.toString()) {
        throw new ApiError(401, "Unauthorized request");
    }

    // Checking if the recipient has blocked the sender
    const isBlocked = await BlockedUser.findOne({
        blocker: recipientUser._id,
        blocked: senderUser._id,
    });

    if (isBlocked) {
        throw new ApiError(
            403,
            "You are blocked by this user and cannot send messages."
        );
    }

    // Checking if the sender and recipient are still friends
    const isFriend = await Friend.findOne({
        $or: [
            { currentUser: senderUser._id, friend: recipientUser._id },
            { currentUser: recipientUser._id, friend: senderUser._id },
        ],
    });

    if (!isFriend) {
        throw new ApiError(403, "You can only send messages to your friends.");
    }

    try {
        const newMessage = await Message.create({
            sender: senderUser._id,
            recipient: recipientUser._id,
            message,
        });
        await newMessage.save();

        return res
            .status(200)
            .json(
                new ApiResponse(200, newMessage, "Message sent successfully")
            );
    } catch (error) {
        console.log("Error while creating message:", error);
        throw new ApiError(500, "Internal server error");
    }
});

//**** DELETE MESSAGE ***** */
const deleteMessage = asyncHandler(async (req, res) => {
    const { messageId } = req.body;
    const userId = req.user._id;

    if (!messageId) {
        throw new ApiError(400, "Message id is required!");
    }

    try {
        const message = await Message.findById(messageId);

        if (!message) {
            throw new ApiError(400, "Message not found");
        }

        if (
            message.sender.toString() !== userId.toString() &&
            message.recipient.toString() !== userId.toString()
        ) {
            throw new ApiError(403, "Unauthorized to delete this message");
        }

        const delMessage = await Message.deleteOne({ _id: message._id });

        return res
            .status(200)
            .json(new ApiResponse(200, "Message deleted successfully"));
    } catch (error) {
        console.log("Error while deleting message:", error);
        throw new ApiError(500, "Internal server error");
    }
});

//**** EDIT MESSAGE ***** */
const editMessage = asyncHandler(async (req, res) => {
    const { messageId, message } = req.body;
    const userId = req.user._id;

    if (!messageId || !message) {
        throw new ApiError(400, "Message ID and message content are required!");
    }

    const existingMessage = await Message.findById(messageId);

    if (!existingMessage) {
        throw new ApiError(400, "Message not found");
    }

    if (!existingMessage.sender.equals(userId)) {
        throw new ApiError(403, "Unauthorized to edit this message");
    }

    // Checking if the sender and recipient are still friends
    const isFriend = await Friend.findOne({
        $or: [
            { currentUser: userId, friend: existingMessage.recipient },
            { currentUser: existingMessage.recipient, friend: userId },
        ],
    });

    if (!isFriend) {
        throw new ApiError(403, "You can only edit messages to your friends.");
    }

    try {
        const updatedMessage = await Message.findByIdAndUpdate(
            messageId,
            {
                $set: {
                    message: message,
                    edited: true,
                },
            },
            { new: true }
        );

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    updatedMessage,
                    "Message updated successfully"
                )
            );
    } catch (error) {
        console.log("Error while editing message:", error);
        throw new ApiError(500, "Internal sever error");
    }
});

//***** FETCH SENDER MESSAGE (i sended) ***** */
const fetchSentMessages = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { recipient } = req.body;

    if (!recipient) {
        throw new ApiError(400, "Recipient id is required");
    }

    // Fetching sender and recipient IDs
    const recipientUser = await User.findOne({ userName: recipient });

    if (!recipientUser) {
        throw new ApiError(404, "Recipient not found");
    }

    try {
        const sentMessages = await Message.find({
            sender: userId,
            recipient: recipientUser._id,
        })
            .populate({
                path: "recipient",
                select: "userName",
            })
            .select("_id message recipient createdAt updatedAt");

        const formattedMessages = sentMessages.map((msg) => ({
            mesageId: msg._id,
            message: msg.message,
            recipientUserName: msg.recipient.userName,
            createdAt: msg.createdAt,
            updatedAt: msg.updatedAt,
        }));

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    formattedMessages,
                    "Fetched sent messages successfully"
                )
            );
    } catch (error) {
        console.error("Error while fetching sent messages:", error);
        throw new ApiError(500, "Internal server error");
    }
});

//***** FETCH RECIPIENT MESSAGE (i recived) ***** */
const fetchReceivedMessages = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { sender } = req.body;

    if (!sender) {
        throw new ApiError(400, "Sender id is required");
    }

    // Fetching sender ID
    const senderUser = await User.findOne({ userName: sender });

    if (!senderUser) {
        throw new ApiError(404, "Sender not found");
    }

    try {
        const receivedMessages = await Message.find({
            sender: senderUser._id,
            recipient: userId,
        })
            .populate({
                path: "sender",
                select: "userName",
            })
            .select("_id message sender createdAt updatedAt");

        const formattedMessages = receivedMessages.map((msg) => ({
            mesageId: msg._id,
            message: msg.message,
            senderUserName: msg.sender.userName,
            createdAt: msg.createdAt,
            updatedAt: msg.updatedAt,
        }));

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    formattedMessages,
                    "Fetched received messages successfully"
                )
            );
    } catch (error) {
        console.error("Error while fetching received messages:", error);
        throw new ApiError(500, "Internal server error");
    }
});

//***** FRIEND WITH LAST MESSAGE ***** */
// const friendLastMessage = asyncHandler(async (req, res) => {
//     const userId = req.user.id;

//     try {
//         const friends = await Message.aggregate([
//             {
//                 $match: {
//                     $or: [
//                         { sender: new mongoose.Types.ObjectId(userId) },
//                         { recipient: new mongoose.Types.ObjectId(userId) },
//                     ],
//                 },
//             },
//             {
//                 $sort: { createdAt: -1 },
//             },
//             {
//                 $group: {
//                     _id: {
//                         $cond: {
//                             if: {
//                                 $eq: [
//                                     "$sender",
//                                     new mongoose.Types.ObjectId(userId),
//                                 ],
//                             },
//                             then: "$recipient",
//                             else: "$sender",
//                         },
//                     },
//                     lastMessage: { $first: "$$ROOT" },
//                 },
//             },
//             {
//                 $lookup: {
//                     from: "users",
//                     localField: "_id",
//                     foreignField: "_id",
//                     as: "friendDetails",
//                 },
//             },
//             {
//                 $unwind: "$friendDetails",
//             },
//             {
//                 $project: {
//                     _id: 0,
//                     friendId: "$_id",
//                     fullName: "$friendDetails.fullName",
//                     userName: "$friendDetails.userName",
//                     avatar: "$friendDetails.avatar",
//                     lastMessage: "$lastMessage.message",
//                     lastMessageTime: "$lastMessage.createdAt",
//                 },
//             },
//             {
//                 $sort: { lastMessageTime: -1 },
//             },
//         ]).exec();

//         if (friends) {
//             return res
//                 .status(200)
//                 .json(
//                     new ApiResponse(
//                         200,
//                         friends,
//                         "Friend list of last message fetched successfuly"
//                     )
//                 );
//         }
//     } catch (error) {
//         console.log("Error while fetching friends last message:", error);
//         throw new ApiError(500, "Error while fethching last message");
//     }
// });

const getFriendsWithLastMessage = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    try {
        // Fetch all friends
        const friends = await Friend.find({ currentUser: userId }).populate("friend");
            console.log("frds:",friends);
            const friendIds = friends.map(friendship => friendship.friend._id);
            console.log("frdiDs:",friendIds);

        // Fetch last message for each friend
        const lastMessages = await Message.aggregate([
            {
                $match: {
                    $or: [
                        { sender: { $in: friendIds } },
                        { recipient: { $in: friendIds } },
                    ],
                },
            },
            {
                $sort: { createdAt: -1 },
            },
            {
                $group: {
                    _id: {
                        $cond: {
                            if: { $eq: ["$sender", new mongoose.Types.ObjectId(userId)] },
                            then: "$recipient",
                            else: "$sender",
                        },
                    },
                    lastMessage: { $first: "$$ROOT" },
                },
            },
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "friendDetails",
                },
            },
            {
                $unwind: "$friendDetails",
            },
            {
                $project: {
                    _id: 0,
                    friendId: "$_id",
                    fullName: "$friendDetails.fullName",
                    userName: "$friendDetails.userName",
                    avatar: "$friendDetails.avatar",
                    lastMessage: "$lastMessage.message",
                    lastMessageTime: "$lastMessage.createdAt",
                },
            },
            {
                $sort: { lastMessageTime: -1 },
            },
        ]).exec();

        // Format friends data with last messages
        const formattedFriends = friends.map(friendship => {
            const lastMessage = lastMessages.find(msg => msg.friendId.toString() === friendship.friend._id.toString());
            return {
                friendId: friendship.friend._id,
                fullName: friendship.friend.fullName,
                userName: friendship.friend.userName,
                avatar: friendship.friend.avatar,
                lastMessage: lastMessage ? lastMessage.lastMessage : 'New, Say Hii👋',
                lastMessageTime: lastMessage ? lastMessage.lastMessageTime : null,
            };
        });

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    formattedFriends,
                    "Friends with last message fetched successfully"
                )
            );
    } catch (error) {
        console.log("Error fetching friends with last messages:", error);
        throw new ApiError(500, "Internal server error");
    }
});


export {
    createMessage,
    editMessage,
    deleteMessage,
    fetchSentMessages,
    fetchReceivedMessages,
    // friendLastMessage,
    getFriendsWithLastMessage
};
