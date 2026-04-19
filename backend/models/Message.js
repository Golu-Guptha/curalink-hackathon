import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
    {
        sessionId: {
            type: String,                // String session ID matching Session._id
            required: true,
            index: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        role: {
            type: String,
            enum: ['user', 'assistant'],
            required: true,
        },
        content: {
            type: String,
            required: true,
        },
        // Full structured AI response (only for assistant messages)
        structuredResponse: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
        // Metadata about the pipeline run
        metadata: {
            disease: String,
            intent: String,
            location: String,
            expanded_query: String,
            total_candidates: Number,
            publications_ranked: Number,
            trials_ranked: Number,
            model: String,
            fallback: Boolean,
        },
    },
    { timestamps: true }
);

// Fast lookup: get last N messages for a session (context window)
messageSchema.index({ sessionId: 1, createdAt: -1 });

export default mongoose.model('Message', messageSchema);
