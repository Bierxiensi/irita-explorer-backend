import { Document } from 'mongoose';
export interface deleteQuery {
    denom: string,
    nft_id: string,
}

export interface INftStruct {
    denom?: string,
    nft_id?: string,
    owner?: string,
    token_uri?: string,
    token_data?: string,
    create_time?: number,
    update_time?: number,
    hash?: string,
}

export interface INft extends INftStruct,Document {

}