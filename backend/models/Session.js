import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
    {
        _id: {
            type: String,                // Client-generated session ID (e.g. "session_1234_abc")
            required: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        title: {
            type: String,
            default: 'New Research Session',
            maxlength: 200,
        },
        disease: {
            type: String,
            trim: true,
            default: '',
        },
        location: {
            type: String,
            trim: true,
            default: '',
        },
        messageCount: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
        _id: false, // Disable auto ObjectId generation — we supply string IDs
    }
);

// Index for fast user-session lookups sorted by latest
sessionSchema.index({ userId: 1, updatedAt: -1 });

export default mongoose.model('Session', sessionSchema);
