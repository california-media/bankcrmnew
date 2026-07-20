import { useState } from 'react';
import { Modal, Descriptions, message } from 'antd';
import api from '../api/client';

const productLabels = { credit_card: 'Credit Card', loan: 'Loan' };

/**
 * Confirmation-only modal. Bank and agency are already on the lead (set at
 * draft creation), so this just confirms the agent wants to send the draft.
 * POST /api/leads/:id/send-to-agency takes no body.
 */
function SendToAgencyModal({ open, onClose, lead, onSent }) {
  const [sending, setSending] = useState(false);

  const onOk = async () => {
    if (!lead) return;
    setSending(true);
    try {
      await api.post(`/leads/${lead._id}/send-to-agency`);
      message.success('Lead sent to agency');
      onSent?.();
      onClose();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      title="Send Lead to Agency?"
      open={open}
      onCancel={onClose}
      onOk={onOk}
      okText="Send"
      confirmLoading={sending}
      destroyOnClose
    >
      {lead && (
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="Client">{lead.customerName}</Descriptions.Item>
          <Descriptions.Item label="Phone">{lead.phone}</Descriptions.Item>
          <Descriptions.Item label="Product">{productLabels[lead.productType]}</Descriptions.Item>
          <Descriptions.Item label="Bank">{lead.bank?.name || '—'}</Descriptions.Item>
          <Descriptions.Item label="Agency">{lead.agency?.name || lead.agency?.email || '—'}</Descriptions.Item>
        </Descriptions>
      )}
    </Modal>
  );
}

export default SendToAgencyModal;
