export function getReqContextIdWithReqId(requestId:string):string{
    if (requestId && requestId.length && requestId.length>=80) {
        return requestId.substr(0,80).toUpperCase();
    }else{
        return '';
    }
}

export function getReqContextIdFromEvents(events:any[]):string{
    let reqContextId:string = '';
    if (events && events.length) {
        events.forEach((item:{attributes:{key:string, value:string}[]})=>{
            if (item.attributes && item.attributes.length) {
                item.attributes.forEach((attribute:{key:string, value:string})=>{
                    if (attribute.key == 'request_context_id') {
                        reqContextId = attribute.value || '';
                    }
                });
            }
        });
    }
    return reqContextId;
}

export function getReqContextIdFromMsgs(msgs:any[]):string{
    let contextId:string = '';
    if (msgs && msgs.length) {
        msgs.forEach((msg:{msg:{request_context_id:string}})=>{
            if (!contextId.length && msg.msg && msg.msg.request_context_id) {
                contextId = msg.msg.request_context_id || '';
            }
        });
    }
    return contextId;
}

export function getRequestIdFromMsgs(msgs:any[]):string{
    let requestId:string = '';
    if (msgs && msgs.length) {
        msgs.forEach((msg:{msg:{request_id:string}})=>{
            if (!requestId.length && msg.msg && msg.msg.request_id) {
                requestId = msg.msg.request_id || '';
            }
        });
    }
    return requestId;
}

export function getServiceNameFromMsgs(msgs:any[]):string{
    let serviceName:string = '';
    if (msgs && msgs.length) {
        msgs.forEach((msg:{msg:{service_name:string, name:string}})=>{
            if (!serviceName.length && msg.msg && (msg.msg.service_name || msg.msg.name)) {
                serviceName = msg.msg.service_name || (msg.msg.name || '');
            }
        });
    }
    return serviceName;
}

export function getConsumerFromMsgs(msgs:any[]):string{
    let consumer:string = '';
    if (msgs && msgs.length) {
        msgs.forEach((msg:{msg:{consumer:string}})=>{
            if (!consumer.length && msg.msg && msg.msg.consumer) {
                consumer = msg.msg.consumer || '';
            }
        });
    }
    return consumer;
}

export function getCtxKey(ctxId:string,type:string){
    return `${ctxId}-${type}`;
}

const common = {
        tx_hash:1,
        msgs:1,
        'msgs.type':1,
        status:1,
        height:1,
        signers:1,
        time:1,
        addrs:1,
        fee:1,
    };

const fromTo = {
        'msgs.msg.fromaddress':1,
        'msgs.msg.toaddress':1,
        'msgs.msg.author':1,
        'msgs.msg.provider':1,
        'msgs.msg.consumer':1,
        'msgs.msg.providers':1,
        'msgs.msg.creator':1,
        'msgs.msg.sender':1,
        'msgs.msg.recipient':1,
        'msgs.msg.owner':1,
        'msgs.msg.delegator_address':1,
        'msgs.msg.validator_address':1,
        'msgs.msg.validator_src_address':1,
        'msgs.msg.validator_dst_address':1
    };

export const dbRes = {
    common,
    fromTo,
    events:{
        events:1
    },
    txList:{
        ...common,
        ...fromTo
    },
    service:{
        ...common,
        ...fromTo,
        events:1,
        'msgs.msg.ex':1,
        'msgs.msg.request_context_id':1,
        'msgs.msg.service_name':1,
        'msgs.msg.name':1,
        'msgs.msg.providers':1,
        'msgs.msg.provider':1,
        'msgs.msg.owner':1,
        'msgs.msg.pricing':1,
        'msgs.msg.qos':1,
        'msgs.msg.deposit':1,
        'msgs.msg.request_id':1
    },
    delegations:{
        ...common,
        ...fromTo,
        'msgs.msg.amount':1,
        'msgs.msg.delegation':1
    },
    validations:{
        ...common,
        'msgs.msg.validator_address':1,
        'msgs.msg.address':1,
        'msgs.msg.min_self_delegation':1
    }
}
