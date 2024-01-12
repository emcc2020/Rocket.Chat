import type { ILivechatTrigger, ILivechatTriggerAction, ILivechatTriggerType, Serialized } from '@rocket.chat/core-typings';
import type { OperationResult } from '@rocket.chat/rest-typings';

import { Livechat } from '../api';
import { upsert } from '../helpers/upsert';
import store from '../store';
import { processUnread } from './main';

let agentPromise: Promise<{ username: string } | Serialized<OperationResult<'GET', '/v1/livechat/agent.next/:token'>>> | null;
const agentCacheExpiry = 3600000;

export const getAgent = (triggerAction: ILivechatTriggerAction) => {
	if (agentPromise) {
		return agentPromise;
	}

	agentPromise = new Promise(async (resolve, reject) => {
		const { params } = triggerAction;

		if (params?.sender === 'queue') {
			const { state } = store;
			const {
				defaultAgent,
				iframe: {
					guest: { department },
				},
			} = state;
			if (defaultAgent?.ts && Date.now() - defaultAgent.ts < agentCacheExpiry) {
				return resolve(defaultAgent); // cache valid for 1
			}

			let agent;
			try {
				agent = await Livechat.nextAgent({ department });
			} catch (error) {
				return reject(error);
			}

			store.setState({ defaultAgent: { ...agent, department, ts: Date.now() } });
			resolve(agent);
		} else if (params?.sender === 'custom') {
			resolve({
				username: params.name,
			});
		} else {
			reject('Unknown sender');
		}
	});

	// expire the promise cache as well
	setTimeout(() => {
		agentPromise = null;
	}, agentCacheExpiry);

	return agentPromise;
};

export const upsertMessage = async (message: Record<string, unknown>) => {
	await store.setState({
		messages: upsert(
			store.state.messages,
			message,
			({ _id }) => _id === message._id,
			({ ts }) => new Date(ts).getTime(),
		),
	});

	await processUnread();
};

export const removeMessage = async (messageId: string) => {
	const { messages } = store.state;
	await store.setState({ messages: messages.filter(({ _id }) => _id !== messageId) });
};

export const hasTriggerCondition = (conditionName: ILivechatTriggerType) => (trigger: ILivechatTrigger) => {
	return trigger.conditions.some((condition) => condition.name === conditionName);
};

export const isInIframe = () => window.self !== window.top;

export const requestTriggerMessages = async ({
	triggerId,
	token,
	metadata = {},
}: {
	triggerId: string;
	token: string;
	metadata: Record<string, string>;
}) => {
	try {
		const extraData = Object.entries(metadata).reduce<{ key: string; value: string }[]>(
			(acc, [key, value]) => [...acc, { key, value }],
			[],
		);

		const { response } = await Livechat.rest.post(`/v1/livechat/triggers/${triggerId}/external-service/call`, { extraData, token });
		return response.contents;
	} catch (e) {
		const error = e as { fallbackMessage?: string };
		if (!error.fallbackMessage) {
			throw Error('Unable to fetch message from external service.');
		}

		return [{ msg: error.fallbackMessage, order: 0 }];
	}
};