import { BaseReqDto, PagingReqDto } from './base.dto';
import { ApiError } from '../api/ApiResult';
import { ErrorCodes } from '../api/ResultCodes';
import { ApiProperty } from '@nestjs/swagger';

export class AssetListResDto {
    symbol: number;
    owner: string;
    total_supply: number;
    initial_supply: string;
    max_supply: string;
    mintable: boolean;

    constructor(value) {
        this.symbol = value.symbol;
        this.owner = value.owner;
        this.total_supply = value.total_supply;
        this.initial_supply = value.initial_supply;
        this.max_supply = value.max_supply;
        this.mintable = value.mintable;
    }
}

// tokens/:symbol
export class AssetDetailResDto {
    name: string;
    owner: number;
    total_supply: string;
    initial_supply: string;
    max_supply: string;
    mintable: string;
    scale: number;

    constructor(value) {
        this.name = value.name;
        this.owner = value.owner;
        this.total_supply = value.total_supply;
        this.initial_supply = value.initial_supply;          
        this.max_supply = value.max_supply;
        this.mintable = value.mintable;
        this.scale = value.scale;
    }
}


export class AssetListReqDto extends PagingReqDto{
    static validate(value: any): void {
        super.validate(value);
    }

    static convert(value: any): any {
        super.convert(value);
        return value;
    }
}

export class AssetDetailReqDto extends BaseReqDto {
    @ApiProperty()
    symbol: string;

    static validate(value:any):void{
        if(!value || !value.symbol){
            throw new ApiError(ErrorCodes.InvalidParameter, 'symbol is necessary')
        }
    }

    static convert(value:any):any{
        value.symbol = value.symbol;
        return value;
    }
}