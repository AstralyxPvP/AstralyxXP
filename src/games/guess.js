import { addXP } from '../utils/db.js';
import { checkLevelUp } from '../utils/levels.js';
import { COLORS } from '../utils/embeds.js';
import { sendChannelMessage, editMessage, ephemeralResponse, updateMessageResponse } from '../utils/discord.js';

const QUESTIONS = [
    { q: "What is the rarest ore in Minecraft?", options: ["Emerald", "Diamond", "Ancient Debris", "Lapis"], correct: 2 },
    { q: "How many hearts does a player have?", options: ["10", "20", "15", "5"], correct: 0 },
    { q: "What mob drops Ender Pearls?", options: ["Zombie", "Enderman", "Creeper", "Spider"], correct: 1 },
    { q: "Which tool is best for breaking stone?", options: ["Axe", "Sword", "Pickaxe", "Shovel"], correct: 2 },
    { q: "What dimension is the Ender Dragon in?", options: ["The Nether", "The Overworld", "The End", "The Aether"], correct: 2 },
    { q: "Which mob explodes when it gets near you?", options: ["Skeleton", "Creeper", "Zombie", "Ghast"], correct: 1 },
    { q: "What do you need to mine obsidian?", options: ["Iron Pickaxe", "Gold Pickaxe", "Diamond Pickaxe", "Stone Pickaxe"], correct: 2 },
    { q: "What is the max level of sharpness enchantment?", options: ["III", "V", "IV", "X"], correct: 1 },
    { q: "Which block is used to make a portal to the Nether?", options: ["Obsidian", "Bedrock", "Crying Obsidian", "Netherrack"], correct: 0 },
    { q: "What animal can you tame with bones?", options: ["Cat", "Wolf", "Parrot", "Horse"], correct: 1 },
    { q: "Which item is used to fly in survival?", options: ["Feather", "Elytra", "Phantom Membrane", "Jetpack"], correct: 1 },
    { q: "How many iron ingots make an iron golem?", options: ["4", "9", "36", "3"], correct: 2 },
    { q: "What villager profession buys paper?", options: ["Cleric", "Librarian", "Fletcher", "Farmer"], correct: 1 },
    { q: "What potion effect does a golden apple give?", options: ["Invisibility", "Speed", "Regeneration", "Strength"], correct: 2 },
    { q: "Which mob drops gunpowder?", options: ["Creeper", "Skeleton", "Spider", "Slime"], correct: 0 },
    { q: "What is the building limit in recent Minecraft versions?", options: ["256", "319", "320", "512"], correct: 2 },
    { q: "What can you breed cows with?", options: ["Carrots", "Wheat", "Seeds", "Potatoes"], correct: 1 },
    { q: "Which is the strongest material in vanilla Minecraft?", options: ["Diamond", "Iron", "Netherite", "Obsidian"], correct: 2 }
];

export async function createGame(interaction, env, ctx, xpReward) {
    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + 30000; // 30 seconds
    const channelId = interaction.channel_id;

    const q = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];

    const embed = {
        title: "🤔 Trivia Guessing Game!",
        description: `**${q.q}**\n\n**Base Reward:** ${xpReward} XP\n*Ends in 30 seconds or after 5 correct answers!*`,
        color: COLORS.primary
    };

    const components = [{
        type: 1,
        components: q.options.map((opt, i) => ({
            type: 2,
            style: 2, // SECONDARY
            label: opt,
            custom_id: `game:guess:${sessionId}:${i}`
        }))
    }];

    const msg = await sendChannelMessage(env.DISCORD_TOKEN, channelId, {
        embeds: [embed],
        components
    });

    if (!msg || !msg.id) {
        throw new Error("Failed to send game message");
    }

    const state = JSON.stringify({ correctIndex: q.correct, answered: [], ended: false });
    
    await env.astralyx_xp.prepare(
        "INSERT INTO minigame_sessions (id, channel_id, game_type, message_id, xp_reward, state, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(sessionId, channelId, 'guess', msg.id, xpReward, state, Date.now(), expiresAt).run();

    return { content: `Guess game started in <#${channelId}>!`, flags: 64 };
}

export async function handleComponent(interaction, env, ctx) {
    const parts = interaction.data.custom_id.split(':');
    const sessionId = parts[2];
    const optionIndex = parseInt(parts[3], 10);
    const userId = interaction.member?.user?.id || interaction.user?.id;
    const username = interaction.member?.user?.username || interaction.user?.username;

    try {
        const session = await env.astralyx_xp.prepare(
            "SELECT * FROM minigame_sessions WHERE id = ?"
        ).bind(sessionId).first();

        if (!session) return ephemeralResponse("This game session no longer exists.");

        let state = JSON.parse(session.state);

        if (state.ended || Date.now() > session.expires_at) {
            if (!state.ended) {
                state.ended = true;
                await endAndReward(session, state, env);
                return updateMessageResponse({ components: disableComponents(interaction.message.components) });
            }
            return ephemeralResponse("This game has already ended!");
        }

        if (state.answered.find(a => a.id === userId)) {
            return ephemeralResponse("You have already answered!");
        }

        const isCorrect = optionIndex === state.correctIndex;
        state.answered.push({ id: userId, username, correct: isCorrect, timestamp: Date.now() });

        const correctAnswers = state.answered.filter(a => a.correct).length;
        
        if (correctAnswers >= 5) {
            state.ended = true;
        }

        await env.astralyx_xp.prepare(
            "UPDATE minigame_sessions SET state = ? WHERE id = ?"
        ).bind(JSON.stringify(state), sessionId).run();

        if (state.ended) {
            await endAndReward(session, state, env);
            return updateMessageResponse({ components: disableComponents(interaction.message.components) });
        }

        if (isCorrect) {
            return ephemeralResponse("✅ Correct! You will receive your XP when the game ends.");
        } else {
            return ephemeralResponse("❌ Wrong! Better luck next time.");
        }
    } catch (e) {
        console.error(e);
        return ephemeralResponse("Something went wrong.");
    }
}

async function endAndReward(session, state, env) {
    const correctPlayers = state.answered.filter(a => a.correct).sort((a, b) => a.timestamp - b.timestamp);
    
    let description = "The game has ended! Here are the winners:\n\n";
    
    const { getUser } = await import('../utils/db.js');

    if (correctPlayers.length === 0) {
        description = "Nobody got it right! Better luck next time.";
    } else {
        for (let i = 0; i < correctPlayers.length; i++) {
            const p = correctPlayers[i];
            let earned = i === 0 ? session.xp_reward : Math.floor(session.xp_reward * 0.9);
            
            const userBefore = await getUser(env.astralyx_xp, p.id);
            const oldXp = userBefore.xp;

            await addXP(env.astralyx_xp, p.id, earned);
            const newXp = oldXp + earned;
            const levelUp = checkLevelUp(oldXp, newXp);
            
            description += `${i === 0 ? '🥇' : '✅'} <@${p.id}> earned **${earned} XP**!\n`;
            
            if (levelUp && levelUp.newLevel > levelUp.oldLevel) {
                await sendChannelMessage(env.DISCORD_TOKEN, session.channel_id, {
                    content: `🎉 Congratulations <@${p.id}>! You reached **Level ${levelUp.newLevel}**! 🚀`
                });
            }
        }
    }

    await env.astralyx_xp.prepare("DELETE FROM minigame_sessions WHERE id = ?").bind(session.id).run();
    
    await editMessage(env.DISCORD_TOKEN, session.channel_id, session.message_id, {
        embeds: [{
            title: "🤔 Trivia Guessing Game Ended!",
            description: description,
            color: COLORS.SUCCESS
        }]
    });
}

function disableComponents(components) {
    return components.map(row => ({
        ...row,
        components: row.components.map(btn => ({
            ...btn,
            disabled: true
        }))
    }));
}
