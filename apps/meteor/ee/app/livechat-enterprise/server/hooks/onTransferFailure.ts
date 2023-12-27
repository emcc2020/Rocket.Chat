import { Message } from '@rocket.chat/core-services';
import { isOmnichannelRoom } from '@rocket.chat/core-typings';
import type { IRoom, ILivechatVisitor, ILivechatDepartment, TransferData, AtLeast } from '@rocket.chat/core-typings';
import { LivechatDepartment, LivechatRooms } from '@rocket.chat/models';

import { forwardRoomToDepartment } from '../../../../../app/livechat/server/lib/Helper';
import { settings } from '../../../../../app/settings/server';
import { callbacks } from '../../../../../lib/callbacks';
import { cbLogger } from '../lib/logger';

const onTransferFailure = async (
	room: IRoom,
	{
		guest,
		transferData,
		department,
	}: {
		guest: ILivechatVisitor;
		transferData: TransferData;
		department: AtLeast<ILivechatDepartment, '_id' | 'fallbackForwardDepartment'>;
	},
) => {
	if (!isOmnichannelRoom(room)) {
		return false;
	}

	if (!department?.fallbackForwardDepartment?.length) {
		return false;
	}

	// TODO: find enabled not archived here
	const fallbackDepartment = await LivechatDepartment.findOneById<Pick<ILivechatDepartment, '_id' | 'name'>>(
		department.fallbackForwardDepartment,
		{
			projection: { name: 1, _id: 1 },
		},
	);

	if (!fallbackDepartment) {
		return false;
	}

	const { value } = await LivechatRooms.incNumOfForwardHopsByRoomId(room._id);
	const currentHops = value?.forwardHopsCount || 1;
	const maxHops = settings.get<number>('Omnichannel_max_fallback_forward_depth');

	if (currentHops > maxHops) {
		cbLogger.debug({
			msg: 'Max fallback forward depth reached. Chat wont be transfered',
			roomId: room._id,
			hops: currentHops,
			maxHops,
			departmentId: department._id,
		});
		await LivechatRooms.resetNumberOfForwardHopsByRoomId(room._id);
		return false;
	}

	const transferDataFallback = {
		...transferData,
		prevDepartment: department.name,
		departmentId: department.fallbackForwardDepartment,
		department: fallbackDepartment,
	};

	const forwardSuccess = await forwardRoomToDepartment(room, guest, transferDataFallback);
	if (!forwardSuccess) {
		cbLogger.debug({
			msg: 'Fallback forward failed',
			departmentId: department._id,
			roomId: room._id,
			fallbackDepartmentId: department.fallbackForwardDepartment,
		});
		return false;
	}

	const { _id, username } = transferData.transferredBy;
	await Promise.all([
		Message.saveSystemMessage(
			'livechat_transfer_history_fallback',
			room._id,
			'',
			{ _id, username },
			{ transferData: transferDataFallback },
		),
		LivechatRooms.resetNumberOfForwardHopsByRoomId(room._id),
	]);
	cbLogger.info({
		msg: 'Fallback forward success',
		departmentId: department._id,
		roomId: room._id,
		fallbackDepartmentId: department.fallbackForwardDepartment,
	});
	return true;
};

callbacks.add('livechat:onTransferFailure', onTransferFailure, callbacks.priority.HIGH);
