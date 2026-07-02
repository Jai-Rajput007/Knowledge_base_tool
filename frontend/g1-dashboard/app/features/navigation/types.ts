export interface Location {
    primary_name: string;
    aliases: string[];
    api_id: number;
    all_names: string[];
}

export interface NavStatus {
    robot_agent_reachable: boolean;
    robot_agent_host: string;
    robot_agent_port: number;
    locations_count: number;
    locations: string[];
}

export interface Log {
    ts: string;
    msg: string;
    type: "success" | "error" | "info";
}
