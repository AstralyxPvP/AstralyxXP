import { addXP } from '../utils/db.js';
import { checkLevelUp } from '../utils/levels.js';
import { COLORS } from '../utils/embeds.js';
import { sendChannelMessage, editMessage, ephemeralResponse, updateMessageResponse } from '../utils/discord.js';

const EMOJIS = ['🌊', '🪨', '🌿', '🏠', '🌸'];

export async function createGame(interaction, env, ctx, xpReward) {
    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + 60000; // 60 seconds
    const channelId = interaction.channel_id;

    const duckIndex = Math.floor(Math.random() * EMOJIS.length);

    const embed = {
        title: "🦆 Luck Duck — Find the Duck!",
        description: `The duck is hiding behind one of these emojis!\n\n**Prize:** ${xpReward} XP\n*Ends in 60s!*`,
        color: COLORS.primary
    };

    const components = [{
        type: 1,
        components: EMOJIS.map((emoji, i) => ({
            type: 2,
            style: 2,
            emoji: { name: emoji },
            custom_id: `game:luck_duck:${sessionId}:${i}`
        }))
    }];

    const msg = await sendChannelMessage(env.DISCORD_TOKEN, channelId, {
        embeds: [embed],
        components
    });

    if (!msg || !msg.id) throw new Error("Failed to send game message");

    const state = JSON.stringify({ duckIndex, guesses: [], found: false, ended: false });
    
    await env.astralyx_xp.prepare(
        "INSERT INTO minigame_sessions (id, channel_id, game_type, message_id, xp_reward, state, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(sessionId, channelId, 'luck_duck', msg.id, xpReward, state, Date.now(), expiresAt).run();

    return { content: `Luck Duck game started in <#${channelId}>!`, flags: 64 };
}

export async function handleComponent(interaction, env, ctx) {
    const parts = interaction.data.custom_id.split(':');
    const sessionId = parts[2];
    const index = parseInt(parts[3], 10);
    const userId = interaction.member?.user?.id || interaction.user?.id;

    const session = await env.astralyx_xp.prepare(
        "SELECT * FROM minigame_sessions WHERE id = ?"
    ).bind(sessionId).first();

    if (!session) return ephemeralResponse("This game session no longer exists.");

    let state = JSON.parse(session.state);

    if (state.ended || Date.now() > session.expires_at) {
        if (!state.ended) {
            state.ended = true;
            await env.astralyx_xp.prepare("UPDATE minigame_sessions SET state = ? WHERE id = ?").bind(JSON.stringify(state), sessionId).run();
        }
        return ephemeralResponse("This game has already ended!");
    }

    if (state.guesses.find(g => g.id === userId)) {
        return ephemeralResponse("You already guessed!");
    }

    const isCorrect = index === state.duckIndex;
    state.guesses.push({ id: userId, index, correct: isCorrect, timestamp: Date.now() });

    if (isCorrect && !state.found) {
        state.found = true;
        
        // Update DB to end in 10 seconds
        await env.astralyx_xp.prepare(
            "UPDATE minigame_sessions SET state = ?, expires_at = ? WHERE id = ?"
        ).bind(JSON.stringify(state), Date.now() + 10000, sessionId).run();
        
        return ephemeralResponse("🦆 Quack! You found it! You will receive your XP when the game ends in 10s.");
    } else if (isCorrect) {
        // Someone else already found it, they also guessed correctly
        await env.astralyx_xp.prepare("UPDATE minigame_sessions SET state = ? WHERE id = ?").bind(JSON.stringify(state), sessionId).run();
        return ephemeralResponse("🦆 Quack! You found it! You'll get partial XP.");
    }

    await env.astralyx_xp.prepare("UPDATE minigame_sessions SET state = ? WHERE id = ?").bind(JSON.stringify(state), sessionId).run();
    return ephemeralResponse("No duck here! 🚫");
}

// Background cleanup worker or similar should end the game. Since we can't do cron jobs natively in response,
// we rely on the next click or an explicit sweep to end games.
