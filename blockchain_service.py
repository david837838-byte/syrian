from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

import requests


class BlockchainConfigurationError(Exception):
    pass


class BlockchainProvisioningError(Exception):
    pass


TATUM_ADDRESS_ENDPOINTS = {
    'TRC20': '/v3/tron/address/{xpub}/{index}',
    'ERC20': '/v3/ethereum/address/{xpub}/{index}',
    'ETH': '/v3/ethereum/address/{xpub}/{index}',
    'BEP20': '/v3/bsc/address/{xpub}/{index}',
    'BSC': '/v3/bsc/address/{xpub}/{index}',
    'BTC': '/v3/bitcoin/address/{xpub}/{index}',
}

TATUM_TRANSACTION_ENDPOINTS = {
    'TRC20': '/v3/tron/transaction/{tx_hash}',
    'ERC20': '/v3/ethereum/transaction/{tx_hash}',
    'ETH': '/v3/ethereum/transaction/{tx_hash}',
    'BEP20': '/v3/bsc/transaction/{tx_hash}',
    'BSC': '/v3/bsc/transaction/{tx_hash}',
    'BTC': '/v3/bitcoin/transaction/{tx_hash}',
}


def _extract_first(mapping, *keys):
    for key in keys:
        if isinstance(mapping, dict) and key in mapping and mapping[key] not in (None, ''):
            return mapping[key]
    return None


def _normalize_address(address, network_code=''):
    text = str(address or '').strip()
    if not text:
        return ''

    normalized_network = str(network_code or '').strip().upper()
    if text.startswith('0x') or normalized_network in {'ETH', 'ERC20', 'BEP20', 'BSC'}:
        return text.lower()
    if text.lower().startswith(('bc1', 'tb1')):
        return text.lower()
    return text


def _looks_like_symbol_match(currency_code, symbol_value):
    normalized_currency = str(currency_code or '').strip().upper()
    normalized_symbol = str(symbol_value or '').strip().upper()
    if not normalized_currency or not normalized_symbol:
        return False
    if normalized_currency == normalized_symbol:
        return True
    if normalized_currency == 'USDT' and (
        'USDT' in normalized_symbol or 'TETHER' in normalized_symbol
    ):
        return True
    return False


def _decimal_places_for_asset(currency_code, network_code):
    normalized_currency = str(currency_code or '').strip().upper()
    normalized_network = str(network_code or '').strip().upper()

    if normalized_currency == 'USDT':
        return 6
    if normalized_currency == 'BTC' or normalized_network == 'BTC':
        return 8
    if normalized_currency in {'ETH', 'BNB'} or normalized_network in {'ETH', 'ERC20', 'BEP20', 'BSC'}:
        return 18
    if normalized_currency == 'TRX' or normalized_network in {'TRON', 'TRC20'}:
        return 6
    return None


def _base_unit_threshold(currency_code, network_code):
    normalized_currency = str(currency_code or '').strip().upper()
    normalized_network = str(network_code or '').strip().upper()

    if normalized_currency == 'USDT':
        return Decimal('100000')
    if normalized_currency == 'BTC' or normalized_network == 'BTC':
        return Decimal('1000')
    if normalized_currency in {'ETH', 'BNB'} or normalized_network in {'ETH', 'ERC20', 'BEP20', 'BSC'}:
        return Decimal('1000000')
    if normalized_currency == 'TRX' or normalized_network in {'TRON', 'TRC20'}:
        return Decimal('100000')
    return None


def _to_decimal(value, currency_code='', network_code=''):
    if value in (None, ''):
        return None

    raw_text = str(value).strip()
    if not raw_text:
        return None

    is_hex = raw_text.lower().startswith('0x')
    try:
        if is_hex:
            raw_decimal = Decimal(int(raw_text, 16))
        else:
            raw_decimal = Decimal(raw_text)
    except (InvalidOperation, ValueError, TypeError):
        return None

    decimals = _decimal_places_for_asset(currency_code, network_code)
    threshold = _base_unit_threshold(currency_code, network_code)
    if decimals is None:
        return raw_decimal

    should_scale = False
    if is_hex:
        should_scale = True
    elif all(marker not in raw_text for marker in ('.', 'e', 'E')) and threshold is not None:
        should_scale = abs(raw_decimal) > threshold

    if should_scale:
        return raw_decimal / (Decimal(10) ** decimals)

    return raw_decimal


def _amount_tolerance(currency_code, network_code):
    normalized_currency = str(currency_code or '').strip().upper()
    normalized_network = str(network_code or '').strip().upper()

    if normalized_currency == 'USDT':
        return Decimal('0.000001')
    if normalized_currency == 'BTC' or normalized_network == 'BTC':
        return Decimal('0.00000001')
    if normalized_currency in {'ETH', 'BNB'} or normalized_network in {'ETH', 'ERC20', 'BEP20', 'BSC'}:
        return Decimal('0.000000000001')
    if normalized_currency == 'TRX' or normalized_network in {'TRON', 'TRC20'}:
        return Decimal('0.000001')
    return Decimal('0.000001')


def _append_transfer_candidate(candidates, address, amount, symbol, path):
    normalized_address = str(address or '').strip()
    if not normalized_address:
        return

    candidates.append({
        'address': normalized_address,
        'amount_raw': amount,
        'symbol': symbol,
        'path': path,
    })


def _collect_transfer_candidates(node, path='payload', candidates=None):
    if candidates is None:
        candidates = []

    if isinstance(node, dict):
        direct_amount = _extract_first(
            node,
            'value',
            'amount',
            'tokenAmount',
            'tokenValue',
            'quantity',
            'qty',
            'amount_str',
        )
        direct_symbol = _extract_first(
            node,
            'symbol',
            'tokenSymbol',
            'currency',
            'asset',
            'ticker',
            'name',
        )

        direct_address = _extract_first(
            node,
            'to',
            'toAddress',
            'to_address',
            'recipient',
            'recipientAddress',
            'receiver',
            'dst',
            'destination',
        )
        if direct_address is not None and direct_amount is not None:
            _append_transfer_candidate(candidates, direct_address, direct_amount, direct_symbol, path)

        direct_plain_address = _extract_first(node, 'address')
        if direct_plain_address is not None and direct_amount is not None:
            _append_transfer_candidate(candidates, direct_plain_address, direct_amount, direct_symbol, path)

        addresses = node.get('addresses')
        if isinstance(addresses, list) and direct_amount is not None:
            for address in addresses:
                _append_transfer_candidate(candidates, address, direct_amount, direct_symbol, path)

        for key, value in node.items():
            next_path = f'{path}.{key}'
            if isinstance(value, (dict, list)):
                _collect_transfer_candidates(value, next_path, candidates)

    elif isinstance(node, list):
        for index, item in enumerate(node):
            next_path = f'{path}[{index}]'
            if isinstance(item, (dict, list)):
                _collect_transfer_candidates(item, next_path, candidates)

    return candidates


def match_tatum_transaction_transfer(payload, currency_code, network_code, expected_address, expected_amount):
    expected_amount_decimal = _to_decimal(expected_amount, currency_code, network_code)
    if expected_amount_decimal is None:
        raise BlockchainConfigurationError('Missing expected amount for transaction validation')

    expected_address_normalized = _normalize_address(expected_address, network_code)
    tolerance = _amount_tolerance(currency_code, network_code)
    candidates = _collect_transfer_candidates(payload)

    amount_mismatch_sample = None
    address_matched = False
    for candidate in candidates:
        normalized_candidate_address = _normalize_address(candidate['address'], network_code)
        if normalized_candidate_address != expected_address_normalized:
            continue

        address_matched = True
        candidate_amount = _to_decimal(candidate['amount_raw'], currency_code, network_code)
        if candidate_amount is None:
            if amount_mismatch_sample is None:
                amount_mismatch_sample = {
                    'path': candidate['path'],
                    'amount': None,
                    'symbol': candidate['symbol'],
                }
            continue

        if abs(candidate_amount - expected_amount_decimal) <= tolerance:
            return {
                'matched': True,
                'address_matched': True,
                'amount_matched': True,
                'detected_amount': str(candidate_amount.normalize()),
                'path': candidate['path'],
                'symbol': candidate['symbol'],
                'candidate_count': len(candidates),
            }

        symbol_value = candidate.get('symbol')
        if amount_mismatch_sample is None or _looks_like_symbol_match(currency_code, symbol_value):
            amount_mismatch_sample = {
                'path': candidate['path'],
                'amount': str(candidate_amount.normalize()),
                'symbol': symbol_value,
            }

    result = {
        'matched': False,
        'address_matched': address_matched,
        'amount_matched': False,
        'detected_amount': amount_mismatch_sample['amount'] if amount_mismatch_sample else None,
        'path': amount_mismatch_sample['path'] if amount_mismatch_sample else None,
        'symbol': amount_mismatch_sample['symbol'] if amount_mismatch_sample else None,
        'candidate_count': len(candidates),
    }
    return result


def _coerce_datetime(value):
    if value in (None, ''):
        return None

    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)

    if isinstance(value, (int, float)):
        timestamp = float(value)
        if timestamp > 1_000_000_000_000:
            timestamp /= 1000.0
        return datetime.fromtimestamp(timestamp, tz=timezone.utc)

    text = str(value).strip()
    if not text:
        return None

    if text.isdigit():
        return _coerce_datetime(int(text))

    normalized = text.replace('Z', '+00:00')
    try:
        parsed = datetime.fromisoformat(normalized)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _extract_transaction_timestamp(payload):
    candidates = []
    if isinstance(payload, dict):
        candidates.extend([
            _extract_first(payload, 'timestamp', 'time', 'blockTime', 'blockTimestamp', 'firstSeen', 'createdAt', 'receivedAt'),
            _extract_first(payload.get('receipt', {}), 'timestamp', 'blockTime'),
            _extract_first(payload.get('data', {}), 'timestamp', 'time', 'blockTime', 'blockTimestamp', 'firstSeen', 'createdAt', 'receivedAt'),
        ])

        ret_items = payload.get('ret') or []
        if isinstance(ret_items, list):
            for item in ret_items:
                if isinstance(item, dict):
                    candidates.append(_extract_first(item, 'timestamp', 'time'))

    for candidate in candidates:
        parsed = _coerce_datetime(candidate)
        if parsed:
            return parsed

    return None


def _infer_transaction_confirmation(payload):
    if not isinstance(payload, dict):
        return None

    if payload.get('failed') is True:
        return False

    explicit_success = _extract_first(payload, 'confirmed', 'success')
    if isinstance(explicit_success, bool):
        return explicit_success

    explicit_status = _extract_first(payload, 'status', 'txStatus')
    if explicit_status is not None:
        normalized = str(explicit_status).strip().lower()
        if normalized in {'failed', 'rejected', 'error', 'dropped', '0x0', '0'}:
            return False
        if normalized in {'confirmed', 'completed', 'success', 'ok', '0x1', '1'}:
            return True

    receipt = payload.get('receipt', {})
    receipt_status = _extract_first(receipt, 'status')
    if receipt_status is not None:
        normalized = str(receipt_status).strip().lower()
        if normalized in {'0x0', '0', 'failed', 'error'}:
            return False
        if normalized in {'0x1', '1', 'success', 'ok'}:
            return True

    ret_items = payload.get('ret') or []
    if isinstance(ret_items, list):
        for item in ret_items:
            if isinstance(item, dict):
                contract_ret = _extract_first(item, 'contractRet')
                if contract_ret is not None:
                    normalized = str(contract_ret).strip().lower()
                    if normalized == 'success':
                        return True
                    if normalized in {'fail', 'failed', 'revert'}:
                        return False

    if _extract_first(payload, 'blockNumber', 'blockHeight', 'confirmations') not in (None, '', 0, '0'):
        return True

    return None


def generate_tatum_address_from_xpub(api_key, base_url, network_code, xpub, index, eth_testnet_type='ethereum-sepolia'):
    normalized_network = str(network_code or '').strip().upper()
    endpoint = TATUM_ADDRESS_ENDPOINTS.get(normalized_network)
    if not endpoint:
        raise BlockchainConfigurationError(f'Unsupported network for Tatum address generation: {normalized_network}')

    if not api_key:
        raise BlockchainConfigurationError('Missing Tatum API key')
    if not xpub:
        raise BlockchainConfigurationError(f'Missing XPUB for network {normalized_network}')

    url = f"{str(base_url or 'https://api.tatum.io').rstrip('/')}{endpoint.format(xpub=xpub, index=int(index))}"
    headers = {
        'accept': 'application/json',
        'x-api-key': api_key
    }
    params = {}

    if normalized_network in ('ERC20', 'ETH') and eth_testnet_type:
        headers['x-testnet-type'] = eth_testnet_type
        params['testnetType'] = eth_testnet_type

    try:
        response = requests.get(url, headers=headers, params=params, timeout=20)
    except requests.RequestException as exc:
        raise BlockchainProvisioningError(f'Provider request failed: {exc}') from exc

    if response.status_code >= 400:
        detail = response.text.strip()[:400]
        raise BlockchainProvisioningError(f'Tatum error {response.status_code}: {detail}')

    try:
        payload = response.json()
    except ValueError as exc:
        raise BlockchainProvisioningError('Provider returned a non-JSON response') from exc

    address = str(
        payload.get('address')
        or payload.get('data', {}).get('address')
        or ''
    ).strip()
    if not address:
        raise BlockchainProvisioningError('Provider response did not include an address')

    return {
        'address': address,
        'provider_name': 'Tatum',
        'network_code': normalized_network,
        'raw': payload
    }


def fetch_tatum_transaction_metadata(api_key, base_url, network_code, tx_hash, eth_testnet_type='ethereum-sepolia'):
    normalized_network = str(network_code or '').strip().upper()
    endpoint = TATUM_TRANSACTION_ENDPOINTS.get(normalized_network)
    if not endpoint:
        raise BlockchainConfigurationError(f'Unsupported network for Tatum transaction lookup: {normalized_network}')

    if not api_key:
        raise BlockchainConfigurationError('Missing Tatum API key')

    normalized_hash = str(tx_hash or '').strip()
    if not normalized_hash:
        raise BlockchainConfigurationError('Missing transaction hash')

    url = f"{str(base_url or 'https://api.tatum.io').rstrip('/')}{endpoint.format(tx_hash=normalized_hash)}"
    headers = {
        'accept': 'application/json',
        'x-api-key': api_key
    }
    params = {}

    if normalized_network in ('ERC20', 'ETH') and eth_testnet_type:
        headers['x-testnet-type'] = eth_testnet_type
        params['testnetType'] = eth_testnet_type

    try:
        response = requests.get(url, headers=headers, params=params, timeout=20)
    except requests.RequestException as exc:
        raise BlockchainProvisioningError(f'Provider request failed: {exc}') from exc

    if response.status_code >= 400:
        detail = response.text.strip()[:400]
        raise BlockchainProvisioningError(f'Tatum error {response.status_code}: {detail}')

    try:
        payload = response.json()
    except ValueError as exc:
        raise BlockchainProvisioningError('Provider returned a non-JSON response') from exc

    return {
        'provider_name': 'Tatum',
        'network_code': normalized_network,
        'tx_hash': normalized_hash,
        'confirmed': _infer_transaction_confirmation(payload),
        'timestamp': _extract_transaction_timestamp(payload),
        'raw': payload,
    }
