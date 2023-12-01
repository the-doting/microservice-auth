import { ServiceSchema } from "../../../lib/types";

import _ from "lodash";

const Service: ServiceSchema = {
	name: "auth.phone",
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
		request: {
			rest: "POST /request",
			params: {
				phone: {
					type: "string",
				},
				country: {
					type: "string",
					max: 4,
					// starts with + and 1 or 2 or 3 digits
					pattern: /^\+\d{1,3}$/,
				},
			},
			async handler(ctx) {
				try {
					const { phone, country } = ctx.params;

					// check if phone exists in cache
					const hasOTP = await this.getOTP(phone);

					// if phone exists in cache
					if (hasOTP) {
						const remaining = hasOTP.expireAt - Date.now();

						if (remaining > 0) {
							return {
								code: 400,
								i18n: "OTP_ALREADY_REQUESTED",
								data: {
									date: new Date(hasOTP.expireAt).toISOString(),
									timestamp: hasOTP.expireAt,
									remaining,
								},
							};
						}
					}

					// get AUTH_CONFIG from config
					const configResponse: any = await ctx.call("api.v1.config.get", {
						key: "AUTH_CONFIG",
					});

					// check if config is valid
					if (configResponse.code != 200) {
						return configResponse;
					}

					const configs = configResponse.data.value;

					// get otp length from config
					const otpLength = configs.auth_phone_otp_length;

					// if otp length not exists in config
					if (!otpLength) {
						return {
							code: 400,
							i18n: "NEED_OTP_LENGTH_IN_CONFIG",
							data: {
								key: "auth_phone_otp_length",
							},
						};
					}

					// otp length must be between 4 and 10
					if (otpLength < 4 || otpLength > 10) {
						return {
							code: 400,
							i18n: "OTP_LENGTH_MUST_BE_BETWEEN_4_AND_10",
							data: {
								min: 4,
								max: 10,
							},
						};
					}

					// get otp template from config
					const otpTemplate = configs.auth_phone_otp_template;

					// if otp template not exists in config
					if (!otpTemplate) {
						return {
							code: 400,
							i18n: "NEED_OTP_TEMPLATE_IN_CONFIG",
							data: {
								key: "auth_phone_otp_template",
							},
						};
					}

					// generate otp
					const otp = await this.generateOTP(otpLength);

					// generate otp expire time for 3m
					const otpExpireTime =
						Date.now() + (configs.otp_expire_time ?? 3 * 60 * 1000);

					const receptor = country + phone;

					// send sms
					const result: any = await ctx.call("api.v1.sms.send", {
						receptor: receptor,
						template: configs.auth_phone_otp_template,
						params: {
							param1: otp,
						},
					});

					// if sms not sent
					if (result.code != 200) {
						return result;
					}

					// save otp in cache
					await this.setOTP(phone, country, otp, otpExpireTime);

					return {
						code: 200,
						i18n: "OTP_SENT",
					};
				} catch (error) {
					return {
						code: 500,
					};
				}
			},
		},
		verify: {
			rest: "POST /verify",
			params: {
				phone: {
					type: "string",
				},
				otp: {
					type: "string",
					pattern: /^[0-9]{4,10}$/,
				},
			},
			async handler(ctx) {
				try {
					const { phone, otp } = ctx.params;

					// check if phone exists in cache
					const hasOTP = await this.hasOTP(phone);

					// if phone not exists in cache
					if (!hasOTP) {
						return {
							code: 400,
							i18n: "OTP_NOT_REQUESTED",
						};
					}

					// get otp from cache
					const otpInCache = await this.getOTP(phone);

					// if otp is not same
					if (otpInCache.otp != otp) {
						return {
							code: 400,
							i18n: "OTP_NOT_VALID",
						};
					}

					// create a user
					const user: any = await ctx.call("api.v1.user.create", {
						phone,
						phoneCountryCode: otpInCache.country,
						phoneVerified: true,
						unique: "phone",
					});

					// remove otp from cache
					await this.unsetOTP(phone, otp);

					const resultGenerateToken: any = await ctx.call(
						"api.v1.token.generate",
						{
							identity: user.data.id,
							service: "auth",
						}
					);

					if (resultGenerateToken.code != 200) {
						return resultGenerateToken;
					}

					// @EVENT user.login
					ctx.emit("user.login", {
						user: user.data,
						token: resultGenerateToken.data.token,
					});

					return {
						code: 200,
						i18n: "LOGGEDIN_SUCCESSFULLY",
						data: {
							token: resultGenerateToken.data.token,
						},
					};
				} catch (error) {
					return {
						code: 500,
					};
				}
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
	methods: {
		async generateOTP(length = 6) {
			// generate otp based on length
			const otp = _.random(Math.pow(10, length - 1), Math.pow(10, length) - 1);

			const otpInCache = await this.broker.cacher!.get(`AUTH_PHONE_OTP_${otp}`);

			// if otp exists in cache
			if (otpInCache) {
				// generate again
				return this.generateOTP(length);
			}

			return otp;
		},
		async hasOTP(phone: string) {
			// check if phone exists in cache
			const otpInCache = await this.broker.cacher!.get(
				`AUTH_PHONE_OTP_${phone}`
			);

			// if otp exists in cache
			if (otpInCache) {
				return true;
			}

			return false;
		},
		async getOTP(phone: string) {
			// get otp from cache
			const otpInCache = await this.broker.cacher!.get(
				`AUTH_PHONE_OTP_${phone}`
			);

			if (!otpInCache) {
				return null;
			}

			const otp = JSON.parse(otpInCache as any);

			return otp;
		},
		async setOTP(
			phone: string,
			country: string,
			otp: string,
			expireAt: number
		) {
			// convert timestamp expireAt to seconds
			const ttl = Math.floor((expireAt - Date.now()) / 1000);

			// save otp in cache
			await this.broker.cacher!.set(
				`AUTH_PHONE_OTP_${phone}`,
				JSON.stringify({
					otp,
					country,
					expireAt,
				}),
				ttl
			);

			await this.broker.cacher!.set(`AUTH_PHONE_OTP_${otp}`, phone, ttl);
		},
		async unsetOTP(phone: string, otp: string) {
			// remove otp from cache
			await this.broker.cacher!.del(`AUTH_PHONE_OTP_${phone}`);
			await this.broker.cacher!.del(`AUTH_PHONE_OTP_${otp}`);
		},
	},

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
