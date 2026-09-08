import { axiosInstance } from './axios.instance'

export const installationRecordsUploadApi = {
  uploadPhoto: async (
    uri: string,
    meta: { serialNumber: string; year?: number | string },
  ): Promise<string> => {
    const formData = new FormData()
    formData.append('file', {
      uri,
      type: 'image/jpeg',
      name: 'photo.jpg',
    } as unknown as Blob)
    formData.append('serialNumber', meta.serialNumber)
    if (meta.year != null) {
      formData.append('year', String(meta.year))
    }

    const response = await axiosInstance.post<{ data: { path: string } }>(
      '/installation-records/upload-photo',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    )

    return response.data.data.path
  },
}

