package com.astralyxpvp;

import org.bukkit.ChatColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.jetbrains.annotations.NotNull;

/**
 * /xp - view balance/level (no args)
 * /xp link - link your Discord account
 * /xp unlinked - choose the Minecraft-only path (no /link later, staff merge only)
 */
public final class XpCommand implements CommandExecutor {

    private final XpActions actions;

    public XpCommand(XpActions actions) {
        this.actions = actions;
    }

    @Override
    public boolean onCommand(@NotNull CommandSender sender, @NotNull Command command, @NotNull String label, @NotNull String[] args) {
        if (!(sender instanceof Player)) {
            sender.sendMessage(ChatColor.RED + "Only players can run this command.");
            return true;
        }
        Player p = (Player) sender;

        if (args.length > 0) {
            switch (args[0].toLowerCase()) {
                case "link":
                    actions.link(p);
                    return true;
                case "bind":
                case "manuallink":
                case "manual":
                    if (args.length < 2) {
                        p.sendMessage(ChatColor.RED + "Usage: /xp bind <discordId>");
                        return true;
                    }
                    actions.bind(p, args[1]);
                    return true;
                case "unlinked":
                    actions.chooseUnlinked(p);
                    return true;
                case "claim":
                    actions.daily(p);
                    return true;
                default:
                    break;
            }
        }
        actions.view(p);
        return true;
    }
}