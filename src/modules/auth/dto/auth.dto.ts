import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class SignupDto {
    @IsEmail({}, { message: 'Invalid email format' })
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(6, { message: 'Password must be at least 6 characters long' })
    password: string;

    @IsString()
    @IsNotEmpty()
    firstName: string;

    @IsString()
    @IsNotEmpty()
    lastName: string;

    @IsString()
    @IsOptional()
    mobileNumber?: string;

    @IsString()
    @IsOptional()
    role?: string;
}

export class LoginDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    password: string;
}

export class LinkWalletDto {
    @IsNotEmpty()
    @IsString()
    @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid wallet address' })
    walletAddress: string;

    @IsNotEmpty()
    @IsString()
    signature: string;

    @IsNotEmpty()
    @IsString()
    nonce: string;
}

export class WalletLoginDto {
    @IsNotEmpty()
    @IsString()
    @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid wallet address' })
    walletAddress: string;

    @IsNotEmpty()
    @IsString()
    signature: string;
}

export class NonceRequestDto {
    @IsNotEmpty()
    @IsString()
    @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid wallet address' })
    walletAddress: string;
}
