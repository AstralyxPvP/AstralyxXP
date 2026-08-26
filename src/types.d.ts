interface Env {
  astralyx_xp: D1Database;
  DISCORD_PUBLIC_KEY: string;
  DISCORD_APPLICATION_ID: string;
  DISCORD_TOKEN: string;
}

interface DiscordInteraction {
  id: string;
  type: number;
  guild_id?: string;
  data?: {
    name: string;
    options?: Array<{
      name: string;
      value: any;
    }>;
  };
  member?: {
    user?: {
      id: string;
      username: string;
    };
    roles?: string[];
  };
  channel_id?: string;
  token?: string;
  application_id?: string;
}

interface InteractionResponse {
  body: string;
  status: number;
}
