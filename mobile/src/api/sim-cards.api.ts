import { axiosInstance } from './axios.instance';

export type MobileSimCard = {
  id: string;
  iccid: string;
  ipAddress: string;
  publicIpAddress?: string | null;
  status: string;
  phoneNumber?: string | null;
  apn?: string | null;
  assignedTo?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  shipment?: {
    id: string;
    name: string;
    provider?: string;
  } | null;
};

export const simCardsApi = {
  scanByIccid: async (iccid: string): Promise<MobileSimCard> => {
    const response = await axiosInstance.get(`/sim-cards/scan/${iccid}`);
    return response.data.data;
  },
  claimById: async (id: string): Promise<MobileSimCard> => {
    const response = await axiosInstance.post(`/sim-cards/${id}/claim`);
    return response.data.data;
  },
  myAssigned: async () => {
    const response = await axiosInstance.get('/sim-cards/my-assigned');
    return response.data.data;
  },
};
