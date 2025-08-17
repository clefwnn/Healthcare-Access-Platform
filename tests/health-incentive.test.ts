import { describe, it, expect, beforeEach } from "vitest";

interface RewardSchedule {
	rewardAmount: bigint;
	cooldown: bigint;
}

interface ClaimData {
	activityId: bigint;
	blockHeight: bigint;
}

interface PendingClaim {
	status: boolean;
	verified: boolean;
}

interface MockContract {
	admin: string;
	oracle: string;
	paused: boolean;
	totalRewardsDistributed: bigint;
	patientRewards: Map<string, bigint>;
	activityRewards: Map<bigint, RewardSchedule>;
	approvedActivities: Map<bigint, boolean>;
	lastClaimed: Map<string, ClaimData>;
	pendingClaims: Map<string, PendingClaim>;
	MAX_REWARD_SUPPLY: bigint;
	blockHeight: bigint;

	isAdmin(caller: string): boolean;
	setPaused(
		caller: string,
		pause: boolean
	): { value: boolean } | { error: number };
	setOracle(
		caller: string,
		newOracle: string
	): { value: boolean } | { error: number };
	setRewardSchedule(
		caller: string,
		activityId: bigint,
		rewardAmount: bigint,
		cooldown: bigint
	): { value: boolean } | { error: number };
	removeActivity(
		caller: string,
		activityId: bigint
	): { value: boolean } | { error: number };
	submitClaim(
		caller: string,
		activityId: bigint
	): { value: boolean } | { error: number };
	verifyClaim(
		caller: string,
		patient: string,
		activityId: bigint,
		verified: boolean
	): { value: boolean } | { error: number };
	getPatientRewards(patient: string): { value: bigint };
	getRewardSchedule(activityId: bigint): { value: RewardSchedule | undefined };
	getTotalRewardsDistributed(): { value: bigint };
	isActivityApproved(activityId: bigint): { value: boolean };
}

const mockContract: MockContract = {
	admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
	oracle: "SP000000000000000000002Q6VF78",
	paused: false,
	totalRewardsDistributed: 0n,
	patientRewards: new Map(),
	activityRewards: new Map(),
	approvedActivities: new Map(),
	lastClaimed: new Map(),
	pendingClaims: new Map(),
	MAX_REWARD_SUPPLY: 1_000_000_000n,
	blockHeight: 100n,

	isAdmin(caller: string) {
		return caller === this.admin;
	},

	setPaused(caller: string, pause: boolean) {
		if (!this.isAdmin(caller)) return { error: 100 };
		this.paused = pause;
		return { value: pause };
	},

	setOracle(caller: string, newOracle: string) {
		if (!this.isAdmin(caller)) return { error: 100 };
		if (newOracle === "SP000000000000000000002Q6VF78") return { error: 106 };
		this.oracle = newOracle;
		return { value: true };
	},

	setRewardSchedule(
		caller: string,
		activityId: bigint,
		rewardAmount: bigint,
		cooldown: bigint
	) {
		if (!this.isAdmin(caller)) return { error: 100 };
		if (rewardAmount <= 0n || cooldown <= 0n) return { error: 107 };
		if (activityId <= 0n) return { error: 109 };
		this.activityRewards.set(activityId, { rewardAmount, cooldown });
		this.approvedActivities.set(activityId, true);
		return { value: true };
	},

	removeActivity(caller: string, activityId: bigint) {
		if (!this.isAdmin(caller)) return { error: 100 };
		if (!this.activityRewards.has(activityId)) return { error: 103 };
		this.activityRewards.delete(activityId);
		this.approvedActivities.delete(activityId);
		return { value: true };
	},

	submitClaim(caller: string, activityId: bigint) {
		if (this.paused) return { error: 101 };
		if (!this.activityRewards.has(activityId)) return { error: 103 };
		if (activityId <= 0n) return { error: 109 };
		const lastClaim = this.lastClaimed.get(caller) || {
			activityId: 0n,
			blockHeight: 0n,
		};
		const activity = this.activityRewards.get(activityId)!;
		if (
			lastClaim.activityId === activityId &&
			this.blockHeight < lastClaim.blockHeight + activity.cooldown
		) {
			return { error: 108 };
		}
		this.pendingClaims.set(`${caller}-${activityId}`, {
			status: true,
			verified: false,
		});
		return { value: true };
	},

	verifyClaim(
		caller: string,
		patient: string,
		activityId: bigint,
		verified: boolean
	) {
		if (caller !== this.oracle) return { error: 100 };
		if (this.oracle === "SP000000000000000000002Q6VF78") return { error: 105 };
		if (activityId <= 0n) return { error: 109 };
		if (patient === "SP000000000000000000002Q6VF78") return { error: 106 };
		const claimKey = `${patient}-${activityId}`;
		const claim = this.pendingClaims.get(claimKey);
		if (!claim || !claim.status) return { error: 104 };
		if (verified) {
			const activity = this.activityRewards.get(activityId);
			if (!activity) return { error: 103 };
			const newTotal = this.totalRewardsDistributed + activity.rewardAmount;
			if (newTotal > this.MAX_REWARD_SUPPLY) return { error: 102 };
			this.patientRewards.set(
				patient,
				(this.patientRewards.get(patient) || 0n) + activity.rewardAmount
			);
			this.totalRewardsDistributed = newTotal;
			this.lastClaimed.set(patient, {
				activityId,
				blockHeight: this.blockHeight,
			});
			this.pendingClaims.delete(claimKey);
			return { value: true };
		} else {
			this.pendingClaims.delete(claimKey);
			return { value: false };
		}
	},

	getPatientRewards(patient: string) {
		return { value: this.patientRewards.get(patient) || 0n };
	},

	getRewardSchedule(activityId: bigint) {
		return { value: this.activityRewards.get(activityId) };
	},

	getTotalRewardsDistributed() {
		return { value: this.totalRewardsDistributed };
	},

	isActivityApproved(activityId: bigint) {
		return { value: this.approvedActivities.get(activityId) || false };
	},
};

describe("Health Incentive Contract", () => {
	beforeEach(() => {
		mockContract.admin = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
		mockContract.oracle = "SP000000000000000000002Q6VF78";
		mockContract.paused = false;
		mockContract.totalRewardsDistributed = 0n;
		mockContract.patientRewards = new Map();
		mockContract.activityRewards = new Map();
		mockContract.approvedActivities = new Map();
		mockContract.lastClaimed = new Map();
		mockContract.pendingClaims = new Map();
		mockContract.blockHeight = 100n;
	});

	it("should allow admin to set reward schedule", () => {
		const result = mockContract.setRewardSchedule(
			mockContract.admin,
			1n,
			100n,
			1440n
		);
		expect(result).toEqual({ value: true });
		expect(mockContract.activityRewards.get(1n)).toEqual({
			rewardAmount: 100n,
			cooldown: 1440n,
		});
		expect(mockContract.approvedActivities.get(1n)).toBe(true);
	});

	it("should prevent non-admin from setting reward schedule", () => {
		const result = mockContract.setRewardSchedule("ST2CY5...", 1n, 100n, 1440n);
		expect(result).toEqual({ error: 100 });
	});

	it("should allow patient to submit a claim", () => {
		mockContract.setRewardSchedule(mockContract.admin, 1n, 100n, 1440n);
		const result = mockContract.submitClaim("ST2CY5...", 1n);
		expect(result).toEqual({ value: true });
		expect(mockContract.pendingClaims.get("ST2CY5...-1")).toEqual({
			status: true,
			verified: false,
		});
	});

	it("should prevent claim submission if activity not found", () => {
		const result = mockContract.submitClaim("ST2CY5...", 1n);
		expect(result).toEqual({ error: 103 });
	});

	it("should prevent claim submission during cooldown", () => {
		mockContract.setOracle(mockContract.admin, "ST3NB...");
		mockContract.setRewardSchedule(mockContract.admin, 1n, 100n, 1440n);
		mockContract.submitClaim("ST2CY5...", 1n);
		mockContract.verifyClaim("ST3NB...", "ST2CY5...", 1n, true);
		mockContract.blockHeight = 101n;
		const result = mockContract.submitClaim("ST2CY5...", 1n);
		expect(result).toEqual({ error: 108 });
	});

	it("should allow oracle to verify claim and reward patient", () => {
		mockContract.setOracle(mockContract.admin, "ST3NB...");
		mockContract.setRewardSchedule(mockContract.admin, 1n, 100n, 1440n);
		mockContract.submitClaim("ST2CY5...", 1n);
		const result = mockContract.verifyClaim("ST3NB...", "ST2CY5...", 1n, true);
		expect(result).toEqual({ value: true });
		expect(mockContract.patientRewards.get("ST2CY5...")).toBe(100n);
		expect(mockContract.totalRewardsDistributed).toBe(100n);
		expect(mockContract.pendingClaims.get("ST2CY5...-1")).toBeUndefined();
	});

	it("should prevent non-oracle from verifying claims", () => {
		mockContract.setRewardSchedule(mockContract.admin, 1n, 100n, 1440n);
		mockContract.submitClaim("ST2CY5...", 1n);
		const result = mockContract.verifyClaim("ST4RE...", "ST2CY5...", 1n, true);
		expect(result).toEqual({ error: 100 });
	});

	it("should prevent verification if oracle is invalid", () => {
		mockContract.setRewardSchedule(mockContract.admin, 1n, 100n, 1440n);
		mockContract.submitClaim("ST2CY5...", 1n);
		const result = mockContract.verifyClaim(
			"SP000000000000000000002Q6VF78",
			"ST2CY5...",
			1n,
			true
		);
		expect(result).toEqual({ error: 105 });
	});

	it("should allow admin to pause contract", () => {
		const result = mockContract.setPaused(mockContract.admin, true);
		expect(result).toEqual({ value: true });
		expect(mockContract.paused).toBe(true);
	});

	it("should prevent claim submission when paused", () => {
		mockContract.setPaused(mockContract.admin, true);
		const result = mockContract.submitClaim("ST2CY5...", 1n);
		expect(result).toEqual({ error: 101 });
	});

	it("should prevent reward distribution exceeding max supply", () => {
		mockContract.setOracle(mockContract.admin, "ST3NB...");
		mockContract.setRewardSchedule(
			mockContract.admin,
			1n,
			mockContract.MAX_REWARD_SUPPLY + BigInt(1),
			1440n
		);
		mockContract.submitClaim("ST2CY5...", 1n);
		const result = mockContract.verifyClaim("ST3NB...", "ST2CY5...", 1n, true);
		expect(result).toEqual({ error: 102 });
	});
});
