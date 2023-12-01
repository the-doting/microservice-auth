import { ServiceSchema } from "../../../lib/types";

const Service: ServiceSchema = {
	name: "auth",
	version: "api.v1",

	/**
	 * Service settings
	 */
	settings: {},

	/**
	 * Service dependencies
	 */
	// dependencies: [],

	/**
	 * Actions
	 */
	actions: {
		whoisthis: {
			rest: "GET /whoisthis",
			params: {
				identity: {
					type: "number",
					integer: true,
					positive: true,
					min: 1,
				},
			},
			handler(ctx) {
				return ctx.call("api.v1.user.getById", { id: ctx.params.identity });
			},
		},
	},

	/**
	 * Events
	 */
	events: {},

	/**
	 * Methods
	 */
	methods: {},

	/**
	 * Service created lifecycle event handler
	 */
	// created() {},

	/**
	 * Service started lifecycle event handler
	 */
	// started() { },

	/**
	 * Service stopped lifecycle event handler
	 */
	// stopped() { }
};

export = Service;
