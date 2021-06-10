import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { ListStruct, Result } from '../api/ApiResult';
import {
    TxListReqDto,
    eTxListReqDto,
    TxListWithHeightReqDto,
    TxListWithAddressReqDto,
    TxListWithContextIdReqDto,
    TxListWithNftReqDto,
    TxListWithServicesNameReqDto,
    ServicesDetailReqDto,
    TxListWithCallServiceReqDto,
    TxListWithRespondServiceReqDto,
    PostTxTypesReqDto,
    PutTxTypesReqDto,
    DeleteTxTypesReqDto,
    TxWithHashReqDto,
    ServiceListReqDto,
    ServiceProvidersReqDto,
    ServiceTxReqDto,
    ServiceBindInfoReqDto,
    ServiceRespondReqDto, IdentityTxReqDto,
    TxListWithAssetReqDto
} from '../dto/txs.dto';
import {
    TxResDto,
    TxTypeResDto,
    callServiceResDto,
    ServiceResDto,
    RespondServiceResDto,
    ServiceProvidersResDto,
    ServiceTxResDto,
    ServiceBindInfoResDto,
    ServiceRespondResDto
} from '../dto/txs.dto';
import { IBindTx, IServiceName } from '../types/tx.interface';
import { ITxStruct } from '../types/schemaTypes/tx.interface';
import { INftMapStruct } from '../types/schemaTypes/nft.interface';
import { getReqContextIdFromEvents, getServiceNameFromMsgs } from '../helper/tx.helper';
import Cache from '../helper/cache';
import { TxType, addressPrefix, proposal as proposalString } from '../constant';
import { addressTransform, splitString } from "../util/util";
import { GovHttp } from "../http/lcd/gov.http";
import { getConsensusPubkey } from "../helper/staking.helper"
@Injectable()
export class TxService {
    constructor(@InjectModel('Tx') private txModel: any,
        @InjectModel('TxType') private txTypeModel: any,
        @InjectModel('Denom') private denomModel: any,
        @InjectModel('Nft') private nftModel: any,
        @InjectModel('Identity') private identityModel: any,
        @InjectModel('StakingValidator') private stakingValidatorModel: any,
        @InjectModel('Proposal') private proposalModel: any,
        private readonly govHttp: GovHttp
    ) {
        this.cacheTxTypes();
    }

    async addMonikerToTxs(txList) {
        let validators = await this.stakingValidatorModel.queryAllValidators();
        let validatorMap = {};
        validators.forEach((item) => {
            validatorMap[item.operator_address] = item;
        });


        let txData = txList.map((tx) => {
            let item = JSON.parse(JSON.stringify(tx));
            let monikers = [];
            (item.addrs || []).forEach((addr) => {
                if (validatorMap[addr] &&
                    validatorMap[addr].description &&
                    validatorMap[addr].description.moniker) {
                    let moniker = {};
                    moniker[addr] = validatorMap[addr].is_black ? validatorMap[addr].moniker_m : validatorMap[addr].description.moniker;
                    monikers.push(moniker);
                }
            });
            item.monikers = monikers;
            return item;
        });
        return txData;
    }

    handerEvents(txList) {
        (txList).forEach(tx => {
            (tx.msgs || []).forEach((msg,index) => {
                if (msg.type === TxType.claim_htlc) {
                    (tx.events_new || []).forEach((eventNew) => {
                        if (eventNew.msg_index === index) {
                            let amount, recipient;
                            (eventNew.events || []).forEach(event => {
                                if(event.type === "transfer") {
                                    (event.attributes || []).forEach(item => {
                                        if(item.key === 'amount')  {
                                            amount = item.value
                                        }
                                        if(item.key === 'recipient') {
                                            recipient = item.value
                                        }
                                    })
                                }
                            })
                            msg.msg['amount'] = amount;
                            msg.msg['recipient'] = recipient;
                        }
                    })
                }
                if (msg.type === TxType.withdraw_delegator_reward) {
                    (tx.events_new || []).forEach((eventNew) => {
                        if (eventNew.msg_index === index) {
                            let amount;
                            (eventNew.events || []).forEach((item) => {
                                if(item.type === 'withdraw_rewards') {
                                    (item.attributes || []).forEach((attr) => {
                                        if (attr.key == 'amount') {
                                            amount = attr.value || '--';
                                        }
                                    });
                                }
                            });
                            msg.msg['amount'] = amount;
                        }
                    })
                }
            });
            tx.events_new = undefined;
        });
        return txList
    }

    async cacheTxTypes() {
        const txTypes = await this.txTypeModel.queryTxTypeList();
        Cache.supportTypes = txTypes.map((item) => item.type_name);
    }

    // txs
    async queryTxList(query: TxListReqDto): Promise<ListStruct<TxResDto[]>> {
        // if (!Cache.supportTypes || !Cache.supportTypes.length) {
        await this.cacheTxTypes();
        // }
        const txListData = await this.txModel.queryTxList(query);
        if (txListData.data && txListData.data.length > 0) {
            txListData.data = this.handerEvents(txListData.data)
        }
        let txData = await this.addMonikerToTxs(txListData.data);
        return new ListStruct(TxResDto.bundleData(txData), Number(query.pageNum), Number(query.pageSize), txListData.count);
    }

    // txs/staking
    async queryStakingTxList(query: TxListReqDto): Promise<ListStruct<TxResDto[]>> {
        // if (!Cache.supportTypes || !Cache.supportTypes.length) {
        await this.cacheTxTypes();
        // }
        const txListData = await this.txModel.queryStakingTxList(query);
        if (txListData.data && txListData.data.length > 0) {
            txListData.data = this.handerEvents(txListData.data)
        }
        let txData = await this.addMonikerToTxs(txListData.data);
        return new ListStruct(TxResDto.bundleData(txData), Number(query.pageNum), Number(query.pageSize), txListData.count);
    }

    // txs/coinswap
    async queryCoinswapTxList(query: TxListReqDto): Promise<ListStruct<TxResDto[]>> {
        const txListData = await this.txModel.queryCoinswapTxList(query);
        return new ListStruct(TxResDto.bundleData(txListData.data), Number(query.pageNum), Number(query.pageSize), txListData.count);
    }

    // txs/declaration 
    async queryDeclarationTxList(query: TxListReqDto): Promise<ListStruct<TxResDto[]>> {
        // if (!Cache.supportTypes || !Cache.supportTypes.length) {
        await this.cacheTxTypes();
        // }
        const txListData = await this.txModel.queryDeclarationTxList(query);
        let txData = await this.addMonikerToTxs(txListData.data);
        return new ListStruct(TxResDto.bundleData(txData), Number(query.pageNum), Number(query.pageSize), txListData.count);
    }

    // txs/gov 
    async queryGovTxList(query: TxListReqDto): Promise<ListStruct<TxResDto[]>> {
        // if (!Cache.supportTypes || !Cache.supportTypes.length) {
        await this.cacheTxTypes();
        // }
        if (query.address) {
            query.address = addressTransform(query.address, addressPrefix.iaa)
        }
        const txListData = await this.txModel.queryGovTxList(query);
        const proposalsData = await this.proposalModel.queryAllProposalsSelect();
        const proposalsMap = new Map();
        if (proposalsData && proposalsData.length > 0) {
            proposalsData.forEach(proposal => {
                proposal.content.id = proposal.id;
                proposal.content.proposal_link = !proposal.is_deleted
                proposalsMap.set(proposal.id, proposal.content);
            });
        }
        let txList = [];
        if (txListData && txListData.data && txListData.data.length > 0) {
            txList = txListData.data.map(async tx => {
                let item = JSON.parse(JSON.stringify(tx));
                const msgs = item && item.msgs && item.msgs[0];
                const events = item.events
                if (msgs.type == TxType.vote || msgs.type == TxType.deposit) {
                    let ex = proposalsMap.get(msgs.msg.proposal_id);
                    item.ex = ex;
                    return item
                } else {
                    let proposal_id;
                    events.forEach(event => {
                        if (event.type == TxType.submit_proposal) {
                            event.attributes.forEach(element => {
                                if (element.key == 'proposal_id') {
                                    proposal_id = element.value
                                }
                            });
                        }
                    });
                    let ex = proposalsMap.get(Number(proposal_id));
                    if (!ex) {
                        let proposal = await this.govHttp.getProposalById(proposal_id);
                        let id = proposal && proposal.id;
                        let type = proposal && proposal.content && proposal.content['@type'] && proposal.content['@type']
                        type ? type = splitString(type, '.').replace(proposalString, '') : '';
                        let title = proposal && proposal.content && proposal.content['title']
                        ex = { id, type, title }
                        item.proposal_link = false
                    }
                    item.ex = ex;
                    return item
                }
            });
        }
        txList = await Promise.all(txList)
        let txData = await this.addMonikerToTxs(txList);
        return new ListStruct(TxResDto.bundleData(txData), Number(query.pageNum), Number(query.pageSize), txListData.count);
    }

    // txs/e  供edgeServer调用  返回数据不做过滤
    async queryTxListEdge(query: eTxListReqDto): Promise<ListStruct<any[]>> {
        let txListData = await this.txModel.queryTxListEdge(query.types, query.height, query.pageNum, query.pageSize, query.useCount,query.status);
        let txList = [...txListData.data];
        if (txListData.data && txListData.data.length && txListData.data.length == query.pageSize) {
            let lastItem = txListData.data[txListData.data.length - 1];
            let lastHeightTxData = await this.txModel.queryTxListByHeightEdge(lastItem.height, 1, 10000,false,query.status);
            txList.forEach((value, index) => {
                if (value.height == lastItem.height) {
                    txList.splice(index, 1);
                }
            });
            txList = txList.concat(lastHeightTxData.data);
        }
        return new ListStruct(txList, Number(query.pageNum), Number(query.pageSize), txListData.count);
    }

    // txs/blocks
    async queryTxWithHeight(query: TxListWithHeightReqDto): Promise<ListStruct<TxResDto[]>> {
        await this.cacheTxTypes();
        const txListData = await this.txModel.queryTxWithHeight(query);
        let txData = await this.addMonikerToTxs(txListData.data);
        return new ListStruct(TxResDto.bundleData(txData), Number(query.pageNum), Number(query.pageSize), txListData.count);
    }

    //  txs/addresses
    async queryTxWithAddress(query: TxListWithAddressReqDto): Promise<ListStruct<TxResDto[]>> {
        await this.cacheTxTypes();
        const txListData = await this.txModel.queryTxWithAddress(query);
        if (txListData.data && txListData.data.length > 0) {
            txListData.data = this.handerEvents(txListData.data)
        }
        let txData = await this.addMonikerToTxs(txListData.data);
        return new ListStruct(TxResDto.bundleData(txData), Number(query.pageNum), Number(query.pageSize), txListData.count);
    }

    //  txs/relevance
    async queryTxWithContextId(query: TxListWithContextIdReqDto): Promise<ListStruct<TxResDto[]>> {
        await this.cacheTxTypes();
        const txListData = await this.txModel.queryTxWithContextId(query);
        let txData = await this.addMonikerToTxs(txListData.data);
        return new ListStruct(TxResDto.bundleData(txData), Number(query.pageNum), Number(query.pageSize), txListData.count);
    }

    //  txs/nfts
    async queryTxWithNft(query: TxListWithNftReqDto): Promise<ListStruct<TxResDto[]>> {
        const txListData = await this.txModel.queryTxWithNft(query);
        let txData = await this.addMonikerToTxs(txListData.data);
        return new ListStruct(TxResDto.bundleData(txData), Number(query.pageNum), Number(query.pageSize), txListData.count);
    }

    //废弃
    async queryTxWithServiceName(query: TxListWithServicesNameReqDto): Promise<ListStruct<TxResDto[]>> {
        await this.cacheTxTypes();
        const txListData = await this.txModel.queryTxWithServiceName(query);
        let txData = await this.addMonikerToTxs(txListData.data);
        return new ListStruct(TxResDto.bundleData(txData), Number(query.pageNum), Number(query.pageSize), txListData.count);
    }

    //  txs/services/call-service
    async queryTxWithCallService(query: TxListWithCallServiceReqDto): Promise<ListStruct<callServiceResDto[]>> {
        const callServices = await this.txModel.queryCallServiceWithConsumerAddr(query.consumerAddr, query.pageNum, query.pageSize, query.useCount);
        if (callServices && callServices.data) {
            for (const item of callServices.data) {
                const context_id: string = getReqContextIdFromEvents(item.events);
                if (context_id && context_id.length) {
                    const respond = await this.txModel.queryRespondServiceWithContextId(context_id);
                    item.respond = respond || [];
                } else {
                    item.respond = [];
                }
            }
        }
        return new ListStruct(callServiceResDto.bundleData(callServices.data), Number(query.pageNum), Number(query.pageSize), callServices.count);
    }

    //  txs/services/respond-service
    async queryTxWithRespondService(query: TxListWithRespondServiceReqDto): Promise<ListStruct<TxResDto[]>> {
        const bindServices = await this.txModel.queryBindServiceWithProviderAddr(query.providerAddr, query.pageNum, query.pageSize, query.useCount);
        if (bindServices && bindServices.data) {
            for (const item of bindServices.data) {
                const serviceName: string = getServiceNameFromMsgs(item.msgs);
                item.respond_times = 0;
                item.unbinding_time = 0;
                if (serviceName && serviceName.length) {
                    const respond_times = await this.txModel.queryRespondCountWithServceName(serviceName, query.providerAddr);
                    const disableTxs = await this.txModel.querydisableServiceBindingWithServceName(serviceName, query.providerAddr);
                    item.respond_times = respond_times;
                    if (disableTxs && disableTxs.length) {
                        item.unbinding_time = disableTxs[0].time;
                    }
                }
            }
        }
        return new ListStruct(RespondServiceResDto.bundleData(bindServices.data), Number(query.pageNum), Number(query.pageSize), bindServices.count);
    }

    //  txs/services/detail/{serviceName}
    async queryTxDetailWithServiceName(query: ServicesDetailReqDto): Promise<TxResDto> {
        let result: TxResDto | null = null;
        const txData = await this.txModel.queryTxDetailWithServiceName(query.serviceName);
        if (txData) {
            result = new TxResDto(txData);
        }
        return result;
    }

    //  txs/types
    async queryTxTypeList(): Promise<ListStruct<TxTypeResDto[]>> {
        const txTypeListData = await this.txTypeModel.queryTxTypeList();
        return new ListStruct(TxTypeResDto.bundleData(txTypeListData), Number(0), Number(0));
    }

    // txs/types/service
    async queryServiceTxTypeList(): Promise<ListStruct<TxTypeResDto[]>> {
        const txTypeListData = await this.txTypeModel.queryServiceTxTypeList();
        return new ListStruct(TxTypeResDto.bundleData(txTypeListData), Number(0), Number(0));
    }

    // txs/types/staking
    async queryStakingTxTypeList(): Promise<ListStruct<TxTypeResDto[]>> {
        const txTypeListData = await this.txTypeModel.queryStakingTxTypeList();
        return new ListStruct(TxTypeResDto.bundleData(txTypeListData), Number(0), Number(0));
    }

    // txs/types/declaration
    async queryDeclarationTxTypeList(): Promise<ListStruct<TxTypeResDto[]>> {
        const txTypeListData = await this.txTypeModel.queryDeclarationTxTypeList();
        return new ListStruct(TxTypeResDto.bundleData(txTypeListData), Number(0), Number(0));
    }

    //  post txs/types
    async insertTxTypes(prarms: PostTxTypesReqDto): Promise<ListStruct<TxTypeResDto[]>> {
        const txTypeListData = await this.txTypeModel.insertTxTypes(prarms.typeNames);
        this.cacheTxTypes();
        return new ListStruct(TxTypeResDto.bundleData(txTypeListData), Number(0), Number(0));
    }

    //  put txs/types
    async updateTxType(prarms: PutTxTypesReqDto): Promise<TxTypeResDto> {
        let result: TxTypeResDto | null = null;
        const txData = await this.txTypeModel.updateTxType(prarms.typeName, prarms.newTypeName);
        this.cacheTxTypes();
        if (txData) {
            result = new TxTypeResDto(txData);
        }
        return result;
    }

    //  delete txs/types
    async deleteTxType(prarms: DeleteTxTypesReqDto): Promise<TxTypeResDto> {
        let result: TxTypeResDto | null = null;
        const txData = await this.txTypeModel.deleteTxType(prarms.typeName);
        this.cacheTxTypes();
        if (txData) {
            result = new TxTypeResDto(txData);
        }
        return result;
    }

    // txs/services
    async findServiceList(query: ServiceListReqDto): Promise<ListStruct<ServiceResDto[]>> {
        const { pageNum, pageSize, useCount, nameOrDescription } = query;
        const serviceTxList: ITxStruct[] = await (this.txModel as any).findServiceAllList(pageNum, pageSize, useCount, nameOrDescription);
        const serviceNameList: IServiceName[] = serviceTxList.map((item: any) => {
            const ex: any = item.msgs[0].msg.ex || {};
            return {
                serviceName: getServiceNameFromMsgs(item.msgs),
                description: item.msgs[0].msg.description,
                bind: ex.bind || 0,
            };
        });
        for (const name of serviceNameList) {
            if (name.bind && name.bind > 0) {
                const bindServiceTxList: ITxStruct[] = await (this.txModel as any).findBindServiceTxList(name.serviceName);
                const bindTxList: IBindTx[] = bindServiceTxList.map((item: any) => {
                    return {
                        provider: item.msgs[0].msg.provider,
                        bindTime: item.time,
                    };
                });
                //查出每个provider在当前绑定的serviceName下所有的绑定次数
                for (const bindTx of bindTxList) {
                    bindTx.respondTimes = await (this.txModel as any).findProviderRespondTimesForService(name.serviceName, bindTx.provider);
                }
                name.bindList = bindTxList;
            } else {
                name.bindList = [];
            }
        }
        const res: ServiceResDto[] = serviceNameList.map((service: IServiceName) => {
            return new ServiceResDto(service.serviceName, service.description, service.bindList);
        });
        let count = 0;
        if (useCount) {
            count = await (this.txModel as any).findAllServiceCount(nameOrDescription);
        }
        return new ListStruct(res, pageNum, pageSize, count);
    }

    // /txs/services/providers 
    async queryServiceProviders(query: ServiceProvidersReqDto): Promise<ListStruct<ServiceProvidersResDto[]>> {
        const { serviceName, pageNum, pageSize, useCount } = query;
        const bindServiceTxList: ITxStruct[] = await (this.txModel as any).findBindServiceTxList(serviceName, pageNum, pageSize);
        const bindTxList: IBindTx[] = bindServiceTxList.map((item: any) => {
            return {
                provider: item.msgs[0].msg.provider,
                bindTime: item.time,
            };
        });
        // console.log(query, bindServiceTxList);
        //查出每个provider在当前绑定的serviceName下所有的绑定次数
        for (const bindTx of bindTxList) {
            bindTx.respondTimes = await (this.txModel as any).findProviderRespondTimesForService(serviceName, bindTx.provider);
        }
        const res: ServiceProvidersResDto[] = bindTxList.map((service: ServiceProvidersResDto) => {
            return new ServiceProvidersResDto(service.provider, service.respondTimes, service.bindTime);
        });

        let count = 0;
        if (useCount) {
            count = await (this.txModel as any).findServiceProviderCount(serviceName);
        }
        return new ListStruct(res, pageNum, pageSize, count);
    }

    // /txs/services/tx
    async queryServiceTx(query: ServiceTxReqDto): Promise<ListStruct<ServiceTxResDto[]>> {
        const { serviceName, type, status, pageNum, pageSize, useCount } = query;
        const txList: ITxStruct[] = await (this.txModel as any).findServiceTx(serviceName, type, status, pageNum, pageSize);
        const res: ServiceTxResDto[] = txList.map((service: ITxStruct) => {
            return new ServiceTxResDto(service.tx_hash, service.type, service.height, service.time, service.status, service.msgs, service.events,service.fee);
        });
        let count = 0;
        if (useCount) {
            count = await (this.txModel as any).findServiceTxCount(serviceName, type, status);
        }
        return new ListStruct(res, pageNum, pageSize, count);
    }

    async queryServiceBindInfo(query: ServiceBindInfoReqDto): Promise<ServiceBindInfoResDto | null> {
        const { serviceName, provider } = query;

        const bindTx: ITxStruct = await (this.txModel as any).findBindTx(serviceName, provider);
        const defineTx: ITxStruct = await (this.txModel as any).findServiceOwner(serviceName);
        if (bindTx && defineTx) {
            const hash = bindTx.tx_hash;
            const time = bindTx.time;
            const owner = (defineTx as any).msgs[0].msg.author;
            return new ServiceBindInfoResDto(hash, owner, time);
        } else {
            return null;
        }
    }

    // /txs/services/respond   
    async queryServiceRespondTx(query: ServiceRespondReqDto): Promise<ListStruct<ServiceRespondResDto[]>> {
        const { serviceName, provider, pageNum, pageSize, useCount } = query;
        const respondTxList: ITxStruct[] = await (this.txModel as any).queryServiceRespondTx(serviceName, provider, pageNum, pageSize);
        const res: ServiceRespondResDto[] = respondTxList.map((service: ITxStruct) => {
            const ex: any = (service.msgs as any)[0].msg.ex || {};
            return new ServiceRespondResDto(
                service.tx_hash,
                service.type,
                service.height,
                service.time,
                ex.consumer || '',
                ex.call_hash || '',
                ex.request_context_id || '',
                ex.service_name || '',
                service.status,
            );
        });
        let count = 0;
        if (useCount) {
            count = await (this.txModel as any).findRespondServiceCount(serviceName, provider);
        }
        return new ListStruct(res, pageNum, pageSize, count);

    }

    //  txs/{hash}
    async queryTxWithHash(query: TxWithHashReqDto): Promise<TxResDto> {
        let result: TxResDto | null = null;
        const txData: any = await this.txModel.queryTxWithHash(query.hash);
        if (txData) {
            if (txData.msgs[0] && txData.msgs[0].msg && txData.msgs[0].msg.denom && txData.msgs[0].msg.denom.length) {
                const nftNameInfo: { denom_name: string, nft_name: string } = {
                    denom_name: '',
                    nft_name: '',
                };
                if (txData.msgs[0].msg.id && txData.msgs[0].msg.id.length) {
                    const nft = await this.nftModel.findOneByDenomAndNftId(txData.msgs[0].msg.denom, txData.msgs[0].msg.id);
                    nftNameInfo.denom_name = (nft || {}).denom_name || '';
                    nftNameInfo.nft_name = (nft || {}).nft_name || '';
                } else {
                    const denom = await this.denomModel.findOneByDenomId(txData.msgs[0].msg.denom);
                    nftNameInfo.denom_name = (denom || {}).name || '';
                }
                txData.msgs[0].msg.denom_name = nftNameInfo.denom_name;
                txData.msgs[0].msg.nft_name = nftNameInfo.nft_name;
            }
            if (txData.msgs[0] && txData.msgs[0].type && txData.msgs[0].type === TxType.create_validator && txData.msgs[0].msg && txData.msgs[0].msg.pubkey) {
                txData.msgs[0].msg.pubkey = getConsensusPubkey(JSON.parse(txData.msgs[0].msg.pubkey).key);
            }
            let tx = await this.addMonikerToTxs([txData]);
            result = new TxResDto(tx[0] || {});
        }
        return result;
    }
    //tx/identity
    async queryIdentityTx(query: IdentityTxReqDto): Promise<ListStruct<TxResDto[]>> {
        const txListData = await this.txModel.queryTxListByIdentity(query);
        return new ListStruct(TxResDto.bundleData(txListData.data), Number(query.pageNum), Number(query.pageSize), txListData.count);
    }

    // txs/asset
    async queryTxWithAsset(query: TxListWithAssetReqDto): Promise<ListStruct<TxResDto[]>> {
        const txData = await this.txModel.queryTxWithAsset(query);
        return new ListStruct(TxResDto.bundleData(txData.data), Number(query.pageNum), Number(query.pageSize), txData.count);
    }

    // txs/types/gov
    async queryGovTxTypeList(): Promise<TxTypeResDto[]> {
        const txTypeListData = await this.txTypeModel.queryGovTxTypeList();
        return TxTypeResDto.bundleData(txTypeListData);
    }
}

